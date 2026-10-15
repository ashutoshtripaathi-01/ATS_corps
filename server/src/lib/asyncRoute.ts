import type { RequestHandler } from 'express'

/**
 * Express 4 does not catch rejections thrown by async route handlers. The
 * rejection goes unhandled, and since Node 15 an unhandled rejection
 * terminates the process — so a single failing database query in an
 * unguarded route took the entire API down for every user, surfacing to the
 * browser as a bare 502 with no body.
 *
 * Wrapping a handler forwards its rejection to Express's error middleware
 * instead, which answers with a clean JSON 500 and keeps the server alive.
 */
export const ah = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  void Promise.resolve(fn(req, res, next)).catch(next)
}
