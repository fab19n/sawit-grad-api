import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

// This middleware runs before any protected route handler.
// It checks the Authorization header, verifies the JWT token,
// and attaches the decoded user info to req.user.
// If the token is missing or invalid, it returns 401 immediately
// and the route handler never runs — this is the security gate.
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Tokens are sent as "Bearer <token>" in the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Tidak dibenarkan. Token diperlukan.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET!;

    // jwt.verify throws if the token is expired or tampered with
    const decoded = jwt.verify(token, secret) as {
      id: string; email: string; role: 'grader' | 'manager' | 'admin'; millId: string;
    };

    // Attach user info to the request so downstream handlers can use it
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token tidak sah atau telah tamat.' });
  }
};

// Role-based access — only allow certain roles past this point.
// Usage: router.get('/admin-only', protect, requireRole('admin'), handler)
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }
    next();
  };
};