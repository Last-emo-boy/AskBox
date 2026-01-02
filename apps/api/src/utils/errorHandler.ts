import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { securityLogger, SecurityEventType, SecuritySeverity } from './securityLogger.js';

/**
 * Standard error codes for API responses
 * These are safe to expose to clients
 */
export enum ErrorCode {
  // Client errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * User-friendly error messages (safe to expose)
 */
const safeMessages: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_REQUEST]: 'The request is invalid',
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.CONFLICT]: 'Resource already exists',
  [ErrorCode.RATE_LIMITED]: 'Too many requests, please try again later',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Request payload is too large',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

/**
 * Structured API error response
 */
interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a sanitized error response
 * In production, we don't expose internal details
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: unknown
): ApiErrorResponse {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    error: {
      code,
      message: customMessage || safeMessages[code],
      // Only include details in non-production
      ...(details && !isProduction ? { details } : {}),
    },
  };
}

/**
 * Map HTTP status to error code
 */
function statusToErrorCode(status: number): ErrorCode {
  const statusMap: Record<number, ErrorCode> = {
    400: ErrorCode.INVALID_REQUEST,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    413: ErrorCode.PAYLOAD_TOO_LARGE,
    429: ErrorCode.RATE_LIMITED,
    500: ErrorCode.INTERNAL_ERROR,
    503: ErrorCode.SERVICE_UNAVAILABLE,
  };
  return statusMap[status] || ErrorCode.INTERNAL_ERROR;
}

/**
 * Format Zod validation errors for safe display
 */
function formatValidationErrors(error: ZodError): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return issues.join('; ');
}

/**
 * Sanitize error message - remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Remove stack traces
  const noStack = message.split('\n')[0];
  
  // Remove file paths
  const noPath = noStack.replace(/\/[\w/.-]+/g, '[path]');
  
  // Remove potential SQL/DB info
  const noDbInfo = noPath.replace(/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|TABLE|COLUMN|DATABASE|postgresql|prisma)\b/gi, '[db]');
  
  // Remove potential secrets (anything that looks like a token/key)
  const noSecrets = noDbInfo.replace(/[a-zA-Z0-9_-]{20,}/g, '[redacted]');
  
  // Truncate if too long
  return noSecrets.length > 200 ? noSecrets.substring(0, 200) + '...' : noSecrets;
}

/**
 * Global error handler for Fastify
 */
export function createErrorHandler() {
  return function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Log error internally with full details
    request.log.error({
      err: error,
      requestId: request.id,
      url: request.url,
      method: request.method,
    }, 'Request error');

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send(
        createErrorResponse(
          ErrorCode.INVALID_REQUEST,
          'Validation failed',
          formatValidationErrors(error)
        )
      );
    }

    // Handle rate limiting
    if (error.statusCode === 429) {
      securityLogger.rateLimitExceeded(request, request.url);
      return reply.status(429).send(
        createErrorResponse(ErrorCode.RATE_LIMITED)
      );
    }

    // Handle known status codes
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      const code = statusToErrorCode(error.statusCode);
      const message = error.message && error.message.length < 100 
        ? sanitizeErrorMessage(error.message)
        : undefined;
      
      return reply.status(error.statusCode).send(
        createErrorResponse(code, message)
      );
    }

    // Log critical errors
    if (!error.statusCode || error.statusCode >= 500) {
      securityLogger.log(
        SecurityEventType.SUSPICIOUS_REQUEST,
        SecuritySeverity.ERROR,
        'Internal server error',
        request,
        { errorType: error.name }
      );
    }

    // All other errors - return generic message
    const status = error.statusCode || 500;
    return reply.status(status).send(
      createErrorResponse(statusToErrorCode(status))
    );
  };
}

/**
 * Custom error classes for business logic
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, ErrorCode.NOT_FOUND, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, ErrorCode.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, ErrorCode.CONFLICT, message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, ErrorCode.INVALID_REQUEST, message);
    this.name = 'ValidationError';
  }
}
