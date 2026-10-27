import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/tokens'
import type { TokenPayload } from '../lib/tokens'

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload
      /** The exact raw request-body bytes, stashed by index.ts's json()
       * `verify` hook — needed wherever a signature must be checked against
       * the untouched body rather than the parsed-then-re-serialized object
       * (the Razorpay webhook route, payments.ts). */
      rawBody?: Buffer
    }
  }
}

export function requireAuth(...roles: Array<TokenPayload['role']>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    try {
      const payload = verifyAccessToken(header.slice(7))
      if (roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: 'Insufficient permissions' })
        return
      }
      req.auth = payload
      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }
}
