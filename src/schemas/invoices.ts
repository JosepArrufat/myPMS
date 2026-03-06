import { z } from 'zod'
import { requiredStr, numericId, monetaryStr } from './shared.js'
import { invoiceItemTypeEnum, paymentMethodEnum } from '../db/schema/invoices.js'

export const generateInvoiceBody = z.object({
  reservationId: requiredStr,
})

export const addChargeBody = z.object({
  itemType: z.enum(invoiceItemTypeEnum.enumValues),
  description: requiredStr,
  dateOfService: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: monetaryStr,
  roomId: z.number().int().positive().optional(),
})

export const recordPaymentBody = z.object({
  amount: monetaryStr,
  paymentMethod: z.enum(paymentMethodEnum.enumValues),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
})

export const refundBody = z.object({
  originalPaymentId: numericId,
  amount: monetaryStr,
  reason: requiredStr,
})

export const transferChargeBody = z.object({
  invoiceItemId: numericId,
  targetInvoiceId: requiredStr,
})

export const splitFolioBody = z.object({
  invoiceItemIds: z.array(z.number().int().positive()).min(1, 'At least one item is required'),
})

export const collectDepositBody = z.object({
  reservationId: requiredStr,
  amount: monetaryStr,
  paymentMethod: z.enum(paymentMethodEnum.enumValues),
  transactionReference: z.string().optional(),
})

export const applyDepositBody = z.object({
  reservationId: requiredStr,
  finalInvoiceId: requiredStr,
})

export const refundDepositBody = z.object({
  reservationId: requiredStr,
  reason: requiredStr,
})
