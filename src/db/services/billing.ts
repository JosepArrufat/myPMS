import {
  eq,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  invoiceStatusEnum,
  invoices,
  invoiceItems,
  payments,
} from '../schema/invoices.js'

type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number]
import {
  reservations,
  reservationRooms,
  reservationDailyRates,
} from '../schema/reservations.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

const recalculateInvoice = async (
  invoiceId: string,
  tx: PgTransaction<any, any, any>,
) => {
  const items = await tx
    .select({ total: invoiceItems.total })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))

  const subtotal = items.reduce(
    (sum, i) => sum + parseFloat(String(i.total)),
    0,
  )

  const [inv] = await tx
    .select({
      taxRate: invoices.taxRate,
      paidAmount: invoices.paidAmount,
      discountAmount: invoices.discountAmount,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const taxRate = parseFloat(String(inv?.taxRate ?? '0'))
  const discount = parseFloat(String(inv?.discountAmount ?? '0'))
  const taxAmount = subtotal * taxRate
  const totalAmount = subtotal + taxAmount - discount
  const paidAmount = parseFloat(String(inv?.paidAmount ?? '0'))
  const balance = totalAmount - paidAmount

  let status: InvoiceStatus = 'draft'
  if (balance <= 0 && totalAmount > 0) status = 'paid'
  else if (paidAmount > 0) status = 'partially_paid'
  else if (totalAmount > 0) status = 'issued'

  await tx
    .update(invoices)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      balance: balance.toFixed(2),
      status,
    })
    .where(eq(invoices.id, invoiceId))
}

export const generateInvoice = async (
  reservationId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1)

    if (!reservation) {
      throw new Error('reservation not found')
    }

    const rooms = await tx
      .select()
      .from(reservationRooms)
      .where(eq(reservationRooms.reservationId, reservationId))

    const timestamp = Date.now()
    const [invoice] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: `INV-${timestamp}`,
        invoiceType: 'final',
        reservationId,
        guestId: reservation.guestId,
        issueDate: new Date().toISOString().slice(0, 10),
        status: 'draft',
        createdBy: userId,
      })
      .returning()

    for (const room of rooms) {
      const dailyRates = await tx
        .select()
        .from(reservationDailyRates)
        .where(eq(reservationDailyRates.reservationRoomId, room.id))

      for (const dr of dailyRates) {
        const rate = parseFloat(String(dr.rate))
        await tx
          .insert(invoiceItems)
          .values({
            invoiceId: invoice.id,
            itemType: 'room',
            description: `Room night - ${dr.date}`,
            dateOfService: dr.date,
            quantity: '1',
            unitPrice: dr.rate,
            total: rate.toFixed(2),
            createdBy: userId,
          })
      }
    }

    await recalculateInvoice(invoice.id, tx)

    const [updated] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
      .limit(1)

    return updated
  })
}

export const addCharge = async (
  invoiceId: string,
  item: {
    itemType: 
        'room' | 
        'food' | 
        'beverage' | 
        'minibar' | 
        'laundry' | 
        'spa' | 
        'parking' | 
        'telephone' | 
        'internet' | 
        'other'
    description: string
    dateOfService?: string
    quantity?: string
    unitPrice: string
    roomId?: number
  },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const qty = parseFloat(item.quantity ?? '1')
    const price = parseFloat(item.unitPrice)
    const total = (qty * price).toFixed(2)

    const [newItem] = await tx
      .insert(invoiceItems)
      .values({
        invoiceId,
        itemType: item.itemType,
        description: item.description,
        dateOfService: item.dateOfService,
        quantity: item.quantity ?? '1',
        unitPrice: item.unitPrice,
        total,
        roomId: item.roomId,
        createdBy: userId,
      })
      .returning()

    await recalculateInvoice(invoiceId, tx)

    return newItem
  })
}

export const removeCharge = async (
  invoiceItemId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .delete(invoiceItems)
      .where(eq(invoiceItems.id, invoiceItemId))
      .returning()

    if (!item) {
      throw new Error('invoice item not found')
    }

    await recalculateInvoice(item.invoiceId, tx)

    return item
  })
}

export const recordPayment = async (
  invoiceId: string,
  payment: {
    amount: string
    paymentMethod:
      | 'cash'
      | 'credit_card'
      | 'debit_card'
      | 'bank_transfer'
      | 'cheque'
      | 'online_payment'
      | 'corporate_account'
    transactionReference?: string
    notes?: string
  },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [newPayment] = await tx
      .insert(payments)
      .values({
        invoiceId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        transactionReference: payment.transactionReference,
        notes: payment.notes,
        isRefund: false,
        createdBy: userId,
      })
      .returning()

    const amount = parseFloat(payment.amount)

    await tx.execute(sql`
      UPDATE invoices
      SET paid_amount = COALESCE(paid_amount::numeric, 0) + ${amount},
          balance = COALESCE(balance::numeric, 0) - ${amount},
          status = (CASE
            WHEN COALESCE(balance::numeric, 0) - ${amount} <= 0 THEN 'paid'
            ELSE 'partially_paid'
          END)::invoice_status
      WHERE id = ${invoiceId}
    `)

    return newPayment
  })
}

export const processRefund = async (
  invoiceId: string,
  originalPaymentId: number,
  amount: string,
  reason: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, originalPaymentId))
      .limit(1)

    if (!original) {
      throw new Error('original payment not found')
    }

    const [refund] = await tx
      .insert(payments)
      .values({
        invoiceId,
        amount,
        paymentMethod: original.paymentMethod,
        isRefund: true,
        refundedPaymentId: originalPaymentId,
        notes: reason,
        createdBy: userId,
      })
      .returning()

    const refundAmount = parseFloat(amount)

    await tx.execute(sql`
      UPDATE invoices
      SET paid_amount = COALESCE(paid_amount::numeric, 0) - ${refundAmount},
          balance = COALESCE(balance::numeric, 0) + ${refundAmount},
          status = (CASE
            WHEN COALESCE(paid_amount::numeric, 0) - ${refundAmount} <= 0 THEN 'refunded'
            ELSE 'partially_paid'
          END)::invoice_status
      WHERE id = ${invoiceId}
    `)

    return refund
  })
}
