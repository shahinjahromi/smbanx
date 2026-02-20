import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { ZodError } from 'zod'

/**
 * Global Express error-handling middleware.
 *
 * Must be registered **last** in the middleware stack. Handles three
 * categories of errors and maps them to structured JSON responses:
 *
 * - `ZodError` → `422 Unprocessable Entity` with per-field detail.
 * - `AppError` (and subclasses) → the error's own `statusCode` + `code`.
 * - Anything else → `500 Internal Server Error` (message hidden from client).
 *
 * @param err - The error passed to `next(err)`.
 * @param _req - Express request object (unused).
 * @param res - Express response object used to send the error payload.
 * @param _next - Express next function (unused; required by Express signature).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    })
  }

  console.error('[Unhandled Error]', err)
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  })
}
