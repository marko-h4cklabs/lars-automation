/**
 * Structured error handling for all API routes and workers.
 *
 * Error codes follow: DOMAIN.ACTION (e.g., LEAD.NOT_FOUND, WEBHOOK.RATE_LIMITED)
 * All errors logged to audit_log with full context.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ═══════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════

export class AppError extends Error {
  code: string
  statusCode: number
  context?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.context = context
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      `${entity.toUpperCase()}.NOT_FOUND`,
      `${entity} not found${id ? `: ${id}` : ''}`,
      404,
      { entity, id }
    )
  }
}

export class UnauthorizedError extends AppError {
  constructor(reason = 'Not authenticated') {
    super('AUTH.UNAUTHORIZED', reason, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(reason = 'Access denied') {
    super('AUTH.FORBIDDEN', reason, 403)
  }
}

export class RateLimitError extends AppError {
  constructor(identifier: string, resetSeconds: number) {
    super(
      'SYSTEM.RATE_LIMITED',
      'Too many requests',
      429,
      { identifier, resetSeconds }
    )
  }
}

export class ValidationError extends AppError {
  constructor(field: string, reason: string) {
    super(
      'VALIDATION.INVALID',
      `Invalid ${field}: ${reason}`,
      400,
      { field, reason }
    )
  }
}

// ═══════════════════════════════════════
// ERROR RESPONSE BUILDER
// ═══════════════════════════════════════

interface ErrorResponseBody {
  error: {
    code: string
    message: string
  }
}

export function errorResponse(err: unknown): NextResponse<ErrorResponseBody> {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode }
    )
  }

  const message = err instanceof Error ? err.message : 'Internal server error'
  return NextResponse.json(
    { error: { code: 'SYSTEM.INTERNAL', message } },
    { status: 500 }
  )
}

// ═══════════════════════════════════════
// ERROR LOGGING
// ═══════════════════════════════════════

/**
 * Log an error to audit_log with full context for debugging.
 * Fire-and-forget — never blocks the main flow.
 */
export function logError(
  action: string,
  err: unknown,
  context?: Record<string, unknown>
): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  const code = err instanceof AppError ? err.code : 'UNKNOWN'

  // Fire-and-forget
  Promise.resolve(
    createAdminClient()
      .from('audit_log')
      .insert({
        actor: 'system',
        action: `error.${action}`,
        entity_type: 'error',
        entity_id: null,
        metadata: {
          code,
          message,
          stack: stack?.slice(0, 500),
          ...context,
          ...(err instanceof AppError ? err.context : {}),
        },
      })
  ).catch(() => {})

  console.error(`[${code}] ${action}: ${message}`)
}

// ═══════════════════════════════════════
// SAFE WRAPPER FOR API ROUTE HANDLERS
// ═══════════════════════════════════════

type RouteHandler = (
  ...args: Parameters<(req: Request) => Promise<NextResponse>>
) => Promise<NextResponse>

/**
 * Wraps an API route handler with structured error handling.
 *
 * Usage:
 * export const POST = withErrorHandling(async (request) => { ... })
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (...args) => {
    try {
      return await handler(...args)
    } catch (err) {
      logError('api_route', err)
      return errorResponse(err)
    }
  }
}
