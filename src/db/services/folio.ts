import {
  and,
  eq,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  invoiceStatusEnum,
  invoiceItemTypeEnum,
  invoices,
  invoiceItems,
  payments,
} from '../schema/invoices.js'

type InvoiceItemType = (typeof invoiceItemTypeEnum.enumValues)[number]
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

  type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number]
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

export const postCharge = async (
  invoiceId: string,
  charge: {
    itemType: InvoiceItemType
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
    const qty = parseFloat(charge.quantity ?? '1')
    const price = parseFloat(charge.unitPrice)
    const total = (qty * price).toFixed(2)

    const [item] = await tx
      .insert(invoiceItems)
      .values({
        invoiceId,
        itemType: charge.itemType,
        description: charge.description,
        dateOfService: charge.dateOfService,
        quantity: charge.quantity ?? '1',
        unitPrice: charge.unitPrice,
        total,
        roomId: charge.roomId,
        createdBy: userId,
      })
      .returning()

    await recalculateInvoice(invoiceId, tx)

    return item
  })
}

export const getFolioBalance = async (
  invoiceId: string,
  db: TxOrDb = defaultDb,
) => {
  const [inv] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      subtotal: invoices.subtotal,
      taxAmount: invoices.taxAmount,
      discountAmount: invoices.discountAmount,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      balance: invoices.balance,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!inv) throw new Error('invoice not found')

  const charges = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))

  const pmts = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))

  return {
    invoice: inv,
    charges,
    payments: pmts,
  }
}

export const transferCharge = async (
  invoiceItemId: number,
  targetInvoiceId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.id, invoiceItemId))
      .limit(1)

    if (!item) throw new Error('invoice item not found')

    const sourceInvoiceId = item.invoiceId

    const [target] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, targetInvoiceId))
      .limit(1)

    if (!target) throw new Error('target invoice not found')

    await tx
      .delete(invoiceItems)
      .where(eq(invoiceItems.id, invoiceItemId))

    const [newItem] = await tx
      .insert(invoiceItems)
      .values({
        invoiceId: targetInvoiceId,
        itemType: item.itemType,
        description: item.description,
        dateOfService: item.dateOfService,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        discountAmount: item.discountAmount,
        total: item.total,
        roomId: item.roomId,
        createdBy: userId,
      })
      .returning()

    await recalculateInvoice(sourceInvoiceId, tx)
    await recalculateInvoice(targetInvoiceId, tx)

    return { sourceInvoiceId, targetInvoiceId, item: newItem }
  })
}

export const splitFolio = async (
  sourceInvoiceId: string,
  invoiceItemIds: number[],
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, sourceInvoiceId))
      .limit(1)

    if (!source) throw new Error('source invoice not found')

    const timestamp = Date.now()
    const [newInvoice] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: `INV-SPLIT-${timestamp}`,
        invoiceType: 'final',
        reservationId: source.reservationId,
        guestId: source.guestId,
        issueDate: new Date().toISOString().slice(0, 10),
        status: 'draft',
        createdBy: userId,
      })
      .returning()

    for (const itemId of invoiceItemIds) {
      const [item] = await tx
        .select()
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.id, itemId),
            eq(invoiceItems.invoiceId, sourceInvoiceId),
          ),
        )
        .limit(1)

      if (!item) throw new Error(`item ${itemId} not found on source invoice`)

      await tx.delete(invoiceItems).where(eq(invoiceItems.id, itemId))

      await tx.insert(invoiceItems).values({
        invoiceId: newInvoice.id,
        itemType: item.itemType,
        description: item.description,
        dateOfService: item.dateOfService,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        discountAmount: item.discountAmount,
        total: item.total,
        roomId: item.roomId,
        createdBy: userId,
      })
    }

    await recalculateInvoice(sourceInvoiceId, tx)
    await recalculateInvoice(newInvoice.id, tx)

    const [updatedSource] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, sourceInvoiceId))
      .limit(1)

    const [updatedNew] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, newInvoice.id))
      .limit(1)

    return { sourceInvoice: updatedSource, newInvoice: updatedNew }
  })
}
