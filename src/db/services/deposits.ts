import {
  and,
  eq,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  invoices,
  payments,
  paymentMethodEnum,
} from '../schema/invoices.js'
import { reservations } from '../schema/reservations.js'

type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number]
type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const collectDeposit = async (
  reservationId: string,
  amount: string,
  paymentMethod: PaymentMethod,
  userId: number,
  transactionReference?: string,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1)

    if (!reservation) throw new Error('reservation not found')
    if (!reservation.guestId) throw new Error('reservation has no guest assigned — cannot create deposit')

    let [depositInvoice] = await tx
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.reservationId, reservationId),
          eq(invoices.invoiceType, 'deposit'),
        ),
      )
      .limit(1)

    if (!depositInvoice) {
      const timestamp = Date.now()
      ;[depositInvoice] = await tx
        .insert(invoices)
        .values({
          invoiceNumber: `DEP-${timestamp}`,
          invoiceType: 'deposit',
          reservationId,
          guestId: reservation.guestId,
          issueDate: new Date().toISOString().slice(0, 10),
          status: 'draft',
          totalAmount: amount,
          balance: amount,
          createdBy: userId,
        })
        .returning()
    }
    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId: depositInvoice.id,
        amount,
        paymentMethod,
        transactionReference,
        isRefund: false,
        createdBy: userId,
      })
      .returning()

    const paidAmount = parseFloat(amount)
    await tx.execute(sql`
      UPDATE invoices
      SET paid_amount = COALESCE(paid_amount::numeric, 0) + ${paidAmount},
          balance = COALESCE(balance::numeric, 0) - ${paidAmount},
          status = (CASE
            WHEN COALESCE(balance::numeric, 0) - ${paidAmount} <= 0 THEN 'paid'
            ELSE 'partially_paid'
          END)::invoice_status
      WHERE id = ${depositInvoice.id}
    `)

    const currentDeposit = parseFloat(String(reservation.depositAmount ?? '0'))
    const newDepositTotal = currentDeposit + paidAmount

    await tx
      .update(reservations)
      .set({
        depositAmount: newDepositTotal.toFixed(2),
        depositPaidAt: new Date(),
      })
      .where(eq(reservations.id, reservationId))

    return {
      payment,
      depositInvoiceId: depositInvoice.id,
      totalDeposit: newDepositTotal.toFixed(2),
    }
  })
}


export const applyDepositToInvoice = async (
  reservationId: string,
  finalInvoiceId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const depositInvoices = await tx
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.reservationId, reservationId),
          eq(invoices.invoiceType, 'deposit'),
        ),
      )

    let totalDeposit = 0
    for (const dep of depositInvoices) {
      totalDeposit += parseFloat(String(dep.paidAmount ?? '0'))
    }

    if (totalDeposit <= 0) {
      throw new Error('no deposit found for this reservation')
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId: finalInvoiceId,
        amount: totalDeposit.toFixed(2),
        paymentMethod: 'bank_transfer',
        notes: 'Deposit applied to final invoice',
        isRefund: false,
        createdBy: userId,
      })
      .returning()

    await tx.execute(sql`
      UPDATE invoices
      SET paid_amount = COALESCE(paid_amount::numeric, 0) + ${totalDeposit},
          balance = COALESCE(balance::numeric, 0) - ${totalDeposit},
          status = (CASE
            WHEN COALESCE(balance::numeric, 0) - ${totalDeposit} <= 0 THEN 'paid'
            ELSE 'partially_paid'
          END)::invoice_status
      WHERE id = ${finalInvoiceId}
    `)

    return {
      appliedAmount: totalDeposit.toFixed(2),
      payment,
    }
  })
}

export const refundDeposit = async (
  reservationId: string,
  reason: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const depositInvoices = await tx
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.reservationId, reservationId),
          eq(invoices.invoiceType, 'deposit'),
        ),
      )

    const refunds = []

    for (const dep of depositInvoices) {
      const paid = parseFloat(String(dep.paidAmount ?? '0'))
      if (paid <= 0) continue

      const [refund] = await tx
        .insert(payments)
        .values({
          invoiceId: dep.id,
          amount: paid.toFixed(2),
          paymentMethod: 'bank_transfer',
          isRefund: true,
          notes: `Deposit refund: ${reason}`,
          createdBy: userId,
        })
        .returning()

      await tx.execute(sql`
        UPDATE invoices
        SET paid_amount = COALESCE(paid_amount::numeric, 0) - ${paid},
            balance = COALESCE(balance::numeric, 0) + ${paid},
            status = 'refunded'::invoice_status
        WHERE id = ${dep.id}
      `)

      refunds.push(refund)
    }

    await tx
      .update(reservations)
      .set({
        depositAmount: '0',
      })
      .where(eq(reservations.id, reservationId))

    return { refunds, totalRefunded: refunds.reduce((s, r) => s + parseFloat(String(r.amount)), 0).toFixed(2) }
  })
}


export const getDepositHistory = async (
  reservationId: string,
  db: TxOrDb = defaultDb,
) => {
  const depositInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.reservationId, reservationId),
        eq(invoices.invoiceType, 'deposit'),
      ),
    )

  const allPayments = []
  for (const inv of depositInvoices) {
    const pmts = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, inv.id))

    allPayments.push(...pmts)
  }

  const deposits = allPayments.filter((p) => !p.isRefund)
  const refunds = allPayments.filter((p) => p.isRefund)

  const totalDeposited = deposits.reduce(
    (s, p) => s + parseFloat(String(p.amount)),
    0,
  )
  const totalRefunded = refunds.reduce(
    (s, p) => s + parseFloat(String(p.amount)),
    0,
  )

  return {
    deposits,
    refunds,
    totalDeposited: totalDeposited.toFixed(2),
    totalRefunded: totalRefunded.toFixed(2),
    netDeposit: (totalDeposited - totalRefunded).toFixed(2),
  }
}
