import type { NextFunction, Request, Response } from 'express';
import type { UserAccountSafe } from '../../src/types/archive.ts';
import { verifySessionToken } from '../services/authService.ts';

export const SESSION_COOKIE_NAME = 'hss_session';

export interface AuthenticatedRequest extends Request {
  currentUser?: UserAccountSafe;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const verified = await verifySessionToken(token);
    if (!verified) {
      res.status(401).json({
        error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
      return;
    }
    req.currentUser = verified.user;
    next();
  } catch {
    res.status(401).json({ error: 'Không thể xác thực phiên đăng nhập.' });
  }
}

export function requireRole(allowedRoles: Array<'ADMIN' | 'REVIEWER'>) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
      });
      return;
    }
    next();
  };
}
