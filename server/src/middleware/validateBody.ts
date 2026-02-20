import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

/**
 * Middleware factory that validates and coerces `req.body` against a Zod schema.
 *
 * On success, `req.body` is replaced with the parsed (and potentially
 * transformed) value so downstream handlers receive a fully-typed object.
 * On failure, the raw `ZodError` is forwarded to `next()` and handled by
 * the global {@link errorHandler}.
 *
 * @template T - The TypeScript type inferred from the Zod schema.
 * @param schema - A Zod schema to validate `req.body` against.
 * @returns An Express middleware function.
 * @throws {ZodError} Forwarded to `next()` when validation fails.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      next(err)
    }
  }
}
