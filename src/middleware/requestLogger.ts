import { Request, Response, NextFunction } from 'express';

/**
 * Request-level logger that prints method, path, status and duration.
 * Morgan is great for production, but this lightweight logger
 * is useful for dev/debug and has zero config.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    console.log(log);
  });

  next();
};
