/**
 * Base application error.
 *
 * All domain-specific errors extend this class so that the global
 * {@link errorHandler} middleware can distinguish them from generic
 * {@link Error} instances and return structured JSON responses.
 */
export class AppError extends Error {
  /**
   * @param message - Human-readable description of the error.
   * @param statusCode - HTTP status code to send (default: `500`).
   * @param code - Machine-readable error code included in the response body (optional).
   */
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Thrown when a requested resource does not exist in the database.
 * Produces a `404 Not Found` response.
 */
export class NotFoundError extends AppError {
  /**
   * @param resource - Display name of the missing resource (default: `'Resource'`).
   */
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

/**
 * Thrown when a request lacks valid authentication credentials.
 * Produces a `401 Unauthorized` response.
 */
export class UnauthorizedError extends AppError {
  /**
   * @param message - Custom message (default: `'Unauthorized'`).
   */
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

/**
 * Thrown when an authenticated user attempts to access a resource
 * they do not own. Produces a `403 Forbidden` response.
 */
export class ForbiddenError extends AppError {
  /**
   * @param message - Custom message (default: `'Forbidden'`).
   */
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

/**
 * Thrown when request input fails business-rule validation.
 * Produces a `422 Unprocessable Entity` response.
 */
export class ValidationError extends AppError {
  /**
   * @param message - Description of the validation failure.
   */
  constructor(message: string) {
    super(message, 422, 'VALIDATION_ERROR')
  }
}

/**
 * Thrown when a unique-constraint violation or duplicate-resource
 * condition is detected. Produces a `409 Conflict` response.
 */
export class ConflictError extends AppError {
  /**
   * @param message - Description of the conflict.
   */
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}
