// Extend Error interface to include captureStackTrace
declare global {
  interface ErrorConstructor {
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
  }
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    details?: any
  ) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }
}

// 400 - Bad Request
export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: any) {
    super(message, 400, true, details);
  }
}

// 401 - Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access", details?: any) {
    super(message, 401, true, details);
  }
}

// 403 - Forbidden
export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", details?: any) {
    super(message, 403, true, details);
  }
}

// 404 - Not Found
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: any) {
    super(message, 404, true, details);
  }
}

// 409 - Conflict
export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: any) {
    super(message, 409, true, details);
  }
}

// 422 - Unprocessable Entity
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: any) {
    super(message, 422, true, details);
  }
}

// 429 - Too Many Requests
export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", details?: any) {
    super(message, 429, true, details);
  }
}

// 500 - Internal Server Error
export class InternalServerError extends AppError {
  constructor(message = "Internal server error", details?: any) {
    super(message, 500, false, details);
  }
}

// 503 - Service Unavailable
export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", details?: any) {
    super(message, 503, false, details);
  }
}

// Error Handler Middleware
// export const errorHandler = (
//   err: Error | AppError,
//   req: any,
//   res: any,
//   next: any
// ) => {
//   if (err instanceof AppError) {
//     return res.status(err.statusCode).json({
//       success: false,
//       error: {
//         message: err.message,
//         statusCode: err.statusCode,
//         details: err.details,
//         ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
//       },
//     });
//   }

//   // Handle unknown errors
//   console.error("Unexpected error:", err);

//   return res.status(500).json({
//     success: false,
//     error: {
//       message: "Internal server error",
//       statusCode: 500,
//       ...(process.env.NODE_ENV === "development" && {
//         originalError: err.message,
//         stack: err.stack,
//       }),
//     },
//   });
// };

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
