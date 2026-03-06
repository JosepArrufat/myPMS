import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  generateInvoiceBody,
  addChargeBody,
  recordPaymentBody,
  refundBody,
  transferChargeBody,
  splitFolioBody,
  collectDepositBody,
  applyDepositBody,
  refundDepositBody,
} from '../schemas/invoices.js';
import { numericIdParams } from '../schemas/shared.js';

import {
  findInvoiceByNumber,
  listGuestInvoices,
  listOutstandingInvoices,
  listOverdueInvoices,
  searchInvoices,
} from '../db/queries/finance/invoices.js';

import { listPaymentsForInvoice } from '../db/queries/finance/payments.js';
import { listInvoiceItems } from '../db/queries/finance/invoice-items.js';

import {
  generateInvoice,
  addCharge,
  removeCharge,
  recordPayment,
  processRefund,
} from '../db/services/billing.js';

import {
  postCharge,
  getFolioBalance,
  transferCharge,
  splitFolio,
} from '../db/services/folio.js';

import {
  collectDeposit,
  applyDepositToInvoice,
  refundDeposit,
  getDepositHistory,
} from '../db/services/deposits.js';

// Billing & Invoices
export const invoicesRouter = Router();

// POST /api/invoices/generate
invoicesRouter.post(
  '/generate',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: generateInvoiceBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reservationId } = req.body;
    const invoice = await generateInvoice(reservationId, user.id);
    if ((invoice as any)._alreadyExists) {
      const { _alreadyExists, ...data } = invoice as any;
      return res.status(200).json({ invoice: data, warning: 'Invoice already exists for this reservation' });
    }
    res.status(201).json({ invoice });
  }),
);

// GET /api/invoices/outstanding
invoicesRouter.get(
  '/outstanding',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const invoices = await listOutstandingInvoices();
    res.json({ invoices });
  }),
);

// GET /api/invoices/overdue
invoicesRouter.get(
  '/overdue',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const invoices = await listOverdueInvoices();
    res.json({ invoices });
  }),
);

// GET /api/invoices/search?q=
invoicesRouter.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query as { q?: string };
    if (!q) throw new BadRequestError('q query param is required');
    const invoices = await searchInvoices(q);
    res.json({ invoices });
  }),
);

// GET /api/invoices/guest/:id
invoicesRouter.get(
  '/guest/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from } = req.query as { from?: string };
    const invoices = await listGuestInvoices(req.params.id as string, from);
    res.json({ invoices });
  }),
);

// GET /api/invoices/:number  (keep after static segments)
invoicesRouter.get(
  '/:number',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [invoice] = await findInvoiceByNumber(req.params.number as string);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const items = await listInvoiceItems(invoice.id);
    const payments = await listPaymentsForInvoice(invoice.id);

    res.json({ invoice, items, payments });
  }),
);

// POST /api/invoices/:id/charge
invoicesRouter.post(
  '/:id/charge',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: addChargeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const item = await addCharge(req.params.id as string, req.body, user.id);
    res.status(201).json({ item });
  }),
);

// DELETE /api/invoices/items/:id
invoicesRouter.delete(
  '/items/:id',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ params: numericIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await removeCharge(Number(req.params.id));
    res.json({ item });
  }),
);

// POST /api/invoices/:id/payment
invoicesRouter.post(
  '/:id/payment',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: recordPaymentBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const payment = await recordPayment(req.params.id as string, req.body, user.id);
    res.status(201).json({ payment });
  }),
);

// POST /api/invoices/:id/refund
invoicesRouter.post(
  '/:id/refund',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ body: refundBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { originalPaymentId, amount, reason } = req.body;
    const refund = await processRefund(
      req.params.id as string,
      originalPaymentId,
      amount,
      reason,
      user.id,
    );
    res.json({ refund });
  }),
);

// Folio
export const foliosRouter = Router();

// POST /api/folios/:invoiceId/charge
foliosRouter.post(
  '/:invoiceId/charge',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: addChargeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const item = await postCharge(req.params.invoiceId as string, req.body, user.id);
    res.status(201).json({ item });
  }),
);

// GET /api/folios/:invoiceId
foliosRouter.get(
  '/:invoiceId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getFolioBalance(req.params.invoiceId as string);
    res.json(result);
  }),
);

// POST /api/folios/transfer
foliosRouter.post(
  '/transfer',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ body: transferChargeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { invoiceItemId, targetInvoiceId } = req.body;
    const result = await transferCharge(invoiceItemId, targetInvoiceId, user.id);
    res.json(result);
  }),
);

// POST /api/folios/:invoiceId/split
foliosRouter.post(
  '/:invoiceId/split',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ body: splitFolioBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { invoiceItemIds } = req.body;
    const result = await splitFolio(req.params.invoiceId as string, invoiceItemIds, user.id);
    res.json(result);
  }),
);

// Deposits
export const depositsRouter = Router();

// POST /api/deposits/collect
depositsRouter.post(
  '/collect',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: collectDepositBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reservationId, amount, paymentMethod, transactionReference } = req.body;
    const result = await collectDeposit(
      reservationId,
      amount,
      paymentMethod,
      user.id,
      transactionReference,
    );
    res.status(201).json(result);
  }),
);

// POST /api/deposits/apply
depositsRouter.post(
  '/apply',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  validate({ body: applyDepositBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reservationId, finalInvoiceId } = req.body;
    const result = await applyDepositToInvoice(reservationId, finalInvoiceId, user.id);
    res.json(result);
  }),
);

// POST /api/deposits/refund
depositsRouter.post(
  '/refund',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ body: refundDepositBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reservationId, reason } = req.body;
    const result = await refundDeposit(reservationId, reason, user.id);
    res.json(result);
  }),
);

// GET /api/deposits/:reservationId
depositsRouter.get(
  '/:reservationId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getDepositHistory(req.params.reservationId as string);
    res.json(result);
  }),
);
