import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/tokens'
import type { TokenPayload } from '../lib/tokens'

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload
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
