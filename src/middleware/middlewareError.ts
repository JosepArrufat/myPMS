import { Request, Response, NextFunction } from "express";
import { 
    HttpError, 
    BadRequestError, 
    UnauthorizedError, 
    ForbiddenError, 
    NotFoundError 
} from "../errors.js";

type MiddlewareError = (error: Error, req: Request, res: Response, next: NextFunction) => void;

export const middlewareError: MiddlewareError = (err, req, res, next) => {
    // Drizzle wraps postgres errors inside DrizzleQueryError.cause.
    // Unwrap so we can inspect the real postgres SQLSTATE code and detail.
    const pgErr: any = (err as any)?.cause ?? err;
    const pgCode: string | undefined = pgErr?.code;
    const pgDetail: string | undefined = pgErr?.detail;

    console.error('Error caught by middleware:', (err as any)?.message ?? err, pgCode ? `[pg ${pgCode}]` : '');

    if (err instanceof BadRequestError) {
        res.status(400).json({ error: err.message });
    } else if (err instanceof UnauthorizedError) {
        res.status(401).json({ error: err.message });
    } else if (err instanceof ForbiddenError) {
        res.status(403).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
    } else if (err instanceof HttpError) {
        res.status(err.statusCode).json({ error: err.message });

    // Postgres SQLSTATE codes
    } else if (pgCode === '23505') {
        // unique_violation — extract the conflicting field name from detail
        // e.g. "Key (room_number)=(501) already exists."
        const field = pgDetail?.match(/Key \((.+?)\)=\((.+?)\)/);
        const friendly = field
            ? `${field[1]} '${field[2]}' already exists`
            : pgDetail || 'A record with that value already exists';
        res.status(409).json({ error: friendly });

    } else if (pgCode === '23503') {
        // foreign_key_violation
        const field = pgDetail?.match(/Key \((.+?)\)=\((.+?)\)/);
        const friendly = field
            ? `Referenced ${field[1]} '${field[2]}' does not exist`
            : pgDetail || 'Related record not found';
        res.status(400).json({ error: friendly });

    } else if (pgCode === '23502') {
        // not_null_violation
        const friendly = pgDetail || pgErr?.message || 'A required field is missing';
        res.status(400).json({ error: friendly });

    } else if (pgCode) {
        // Fallback for other SQLSTATE codes
        const message = pgDetail || pgErr?.message || 'Database error';
        res.status(400).json({ error: `${message} (code ${pgCode})` });

    } else {
        const msg: string = (err as any)?.message || '';

        // Inventory / availability conflicts → 409
        if (msg.includes('No inventory row') || msg.includes('Insufficient availability') || msg.includes('slot(s)')) {
            return res.status(409).json({ error: msg });
        }

        // Known service-layer errors (thrown as plain Error) → 400
        if (msg) {
            return res.status(400).json({ error: msg });
        }

        res.status(500).json({ error: 'Something went wrong on our end' });
    }
}