import { FastifyRequest } from 'fastify';

/**
 * Security event types for audit logging
 */
export enum SecurityEventType {
  // Authentication events
  AUTH_CHALLENGE_REQUESTED = 'auth.challenge.requested',
  AUTH_CHALLENGE_EXPIRED = 'auth.challenge.expired',
  AUTH_VERIFY_SUCCESS = 'auth.verify.success',
  AUTH_VERIFY_FAILED = 'auth.verify.failed',
  AUTH_TOKEN_INVALID = 'auth.token.invalid',

  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'ratelimit.exceeded',
  RATE_LIMIT_WARNING = 'ratelimit.warning',

  // Resource access events
  BOX_ACCESS_DENIED = 'box.access.denied',
  QUESTION_ACCESS_DENIED = 'question.access.denied',
  ANSWER_ACCESS_DENIED = 'answer.access.denied',

  // Suspicious activity
  SUSPICIOUS_REQUEST = 'suspicious.request',
  INVALID_INPUT = 'invalid.input',
  CRYPTO_ERROR = 'crypto.error',

  // Resource events
  BOX_CREATED = 'box.created',
  QUESTION_SUBMITTED = 'question.submitted',
  ANSWER_CREATED = 'answer.created',
  ANSWER_PUBLISHED = 'answer.published',
}

/**
 * Severity levels for security events
 */
export enum SecuritySeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

interface SecurityEventData {
  event: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  request?: {
    ip: string;
    userAgent?: string;
    method: string;
    path: string;
    userId?: string;
  };
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Extract request metadata for logging
 */
function extractRequestInfo(request?: FastifyRequest): SecurityEventData['request'] | undefined {
  if (!request) {
    return undefined;
  }

  // Get IP from headers or socket
  const xff = request.headers['x-forwarded-for'];
  let ip = request.ip || 'unknown';
  if (xff) {
    const xffValue = Array.isArray(xff) ? xff[0] : xff;
    if (xffValue) {
      const ips = xffValue.split(',');
      ip = ips[0]?.trim() || ip;
    }
  }

  return {
    ip,
    userAgent: request.headers['user-agent'],
    method: request.method,
    path: request.url,
    userId: (request as any).userId,
  };
}

/**
 * Security logger class
 * In production, this would send to a SIEM, log aggregator, or security monitoring service
 */
class SecurityLogger {
  private serviceName: string;

  constructor(serviceName: string = 'askbox-api') {
    this.serviceName = serviceName;
  }

  /**
   * Log a security event
   */
  log(
    event: SecurityEventType,
    severity: SecuritySeverity,
    message: string,
    request?: FastifyRequest,
    details?: Record<string, unknown>
  ): void {
    const eventData: SecurityEventData = {
      event,
      severity,
      message,
      request: extractRequestInfo(request),
      details: this.sanitizeDetails(details),
      timestamp: new Date().toISOString(),
    };

    // Format log output
    const logOutput = {
      service: this.serviceName,
      ...eventData,
    };

    // Use appropriate log level
    switch (severity) {
      case SecuritySeverity.CRITICAL:
      case SecuritySeverity.ERROR:
        console.error(JSON.stringify(logOutput));
        break;
      case SecuritySeverity.WARNING:
        console.warn(JSON.stringify(logOutput));
        break;
      case SecuritySeverity.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify(logOutput));
        }
        break;
      default:
        console.log(JSON.stringify(logOutput));
    }

    // In production, send to external monitoring
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(eventData);
    }
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) {
      return undefined;
    }

    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'key',
      'signature',
      'private',
      'credential',
      'seed',
      'nonce',
      'ciphertext',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Send critical events to external monitoring (placeholder)
   */
  private sendToMonitoring(_eventData: SecurityEventData): void {
    // In production, implement:
    // - Send to SIEM (Splunk, Elastic, etc.)
    // - Trigger alerts for critical events
    // - Store in audit log database
  }

  // Convenience methods

  authSuccess(request: FastifyRequest, userId: string): void {
    this.log(
      SecurityEventType.AUTH_VERIFY_SUCCESS,
      SecuritySeverity.INFO,
      'User authenticated successfully',
      request,
      { userId }
    );
  }

  authFailed(request: FastifyRequest, reason: string): void {
    this.log(
      SecurityEventType.AUTH_VERIFY_FAILED,
      SecuritySeverity.WARNING,
      `Authentication failed: ${reason}`,
      request
    );
  }

  rateLimitExceeded(request: FastifyRequest, endpoint: string): void {
    this.log(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecuritySeverity.WARNING,
      `Rate limit exceeded for ${endpoint}`,
      request
    );
  }

  accessDenied(request: FastifyRequest, resource: string, reason: string): void {
    this.log(
      SecurityEventType.BOX_ACCESS_DENIED,
      SecuritySeverity.WARNING,
      `Access denied to ${resource}: ${reason}`,
      request
    );
  }

  suspiciousActivity(
    request: FastifyRequest,
    description: string,
    details?: Record<string, unknown>
  ): void {
    this.log(
      SecurityEventType.SUSPICIOUS_REQUEST,
      SecuritySeverity.WARNING,
      `Suspicious activity detected: ${description}`,
      request,
      details
    );
  }

  cryptoError(request: FastifyRequest, operation: string, error: Error): void {
    this.log(
      SecurityEventType.CRYPTO_ERROR,
      SecuritySeverity.ERROR,
      `Cryptographic operation failed: ${operation}`,
      request,
      { operation, errorMessage: error.message }
    );
  }

  resourceCreated(request: FastifyRequest, resourceType: string, resourceId: string): void {
    const eventMap: Record<string, SecurityEventType> = {
      box: SecurityEventType.BOX_CREATED,
      question: SecurityEventType.QUESTION_SUBMITTED,
      answer: SecurityEventType.ANSWER_CREATED,
    };

    this.log(
      eventMap[resourceType] || SecurityEventType.BOX_CREATED,
      SecuritySeverity.INFO,
      `${resourceType} created`,
      request,
      { resourceId }
    );
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();

// Export class for testing
export { SecurityLogger };
