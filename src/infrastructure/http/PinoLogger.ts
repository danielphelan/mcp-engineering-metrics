/**
 * Pino Logger Implementation
 *
 * Production-ready structured logging using Pino.
 * Optimized for Docker, Azure, and other log aggregation systems.
 * Follows Single Responsibility Principle.
 *
 * Features:
 * - Structured JSON logging (perfect for Docker/Azure/CloudWatch)
 * - High performance (5-10x faster than alternatives)
 * - Automatic error serialization with stack traces
 * - Redaction of sensitive fields (passwords, tokens, secrets)
 * - Pretty printing in development mode
 * - Child loggers for request correlation
 */

import pino, { Logger as PinoInstance } from 'pino';
import { ILogger, LogLevel } from '../../domain/interfaces/ILogger.js';

export class PinoLogger implements ILogger {
  private logger: PinoInstance;

  constructor(minLevel: LogLevel = LogLevel.INFO, nodeEnv: string = 'development') {
    // Map our LogLevel enum to Pino levels
    const level = this.mapLogLevel(minLevel);

    // Production: Pure JSON output for log aggregators
    // Development: Pretty formatted output for humans
    const isDevelopment = nodeEnv === 'development' || nodeEnv === 'test';

    this.logger = pino({
      level,

      // Redact sensitive fields automatically
      redact: {
        paths: [
          'password',
          'apiKey',
          'api_key',
          'apiToken',
          'api_token',
          'token',
          'secret',
          'authorization',
          'cookie',
          'set-cookie',
          '*.password',
          '*.apiKey',
          '*.api_key',
          '*.apiToken',
          '*.api_token',
          '*.token',
          '*.secret',
          '*.authorization',
        ],
        remove: true, // Completely remove instead of showing [Redacted]
      },

      // Serialize errors with stack traces
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },

      // Use ISO timestamps (Azure/CloudWatch compatible)
      timestamp: () => `,"time":"${new Date().toISOString()}"`,

      // Format message field
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },

      // Pretty print in development, JSON in production
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,
    });
  }

  /**
   * Map our LogLevel enum to Pino's string levels
   */
  private mapLogLevel(level: LogLevel): string {
    const mapping: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'info',
      [LogLevel.WARN]: 'warn',
      [LogLevel.ERROR]: 'error',
    };
    return mapping[level] || 'info';
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorData = error
      ? { ...meta, error: { message: error.message, stack: error.stack, name: error.name } }
      : meta;

    if (errorData) {
      this.logger.error(errorData, message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Create a child logger with additional context.
   * Useful for adding correlation IDs, session IDs, request IDs, etc.
   *
   * Example:
   *   const requestLogger = logger.child({ requestId: 'abc-123', sessionId: 'xyz-789' });
   *   requestLogger.info('Processing request'); // All logs include requestId and sessionId
   */
  child(bindings: Record<string, unknown>): PinoLogger {
    const childLogger = new PinoLogger();
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  /**
   * Get the underlying Pino logger instance.
   * Useful for advanced use cases like custom transports.
   */
  getPinoInstance(): PinoInstance {
    return this.logger;
  }
}
