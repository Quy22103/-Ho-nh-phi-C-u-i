import type { Request, Response } from 'express';
import { serverConfig } from '../config/env.ts';
import {
  authenticateUser,
  createInitialAdminAccount,
  needsInitialAdminSetup,
  revokeSession,
  verifySessionToken,
} from '../services/authService.ts';
import { appendAuditLog } from '../services/auditService.ts';
import { SESSION_COOKIE_NAME } from '../middleware/authMiddleware.ts';

function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  expMs: number
): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps && serverConfig.nodeEnv === 'production',
    path: '/',
    expires: new Date(expMs),
  });
}

export async function getAuthSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const needsSetup = await needsInitialAdminSetup();
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const verified = await verifySessionToken(token);
    if (!verified) {
      res.json({
        authenticated: false,
        needsInitialAdmin: needsSetup,
        user: null,
      });
      return;
    }
    res.json({
      authenticated: true,
      needsInitialAdmin: false,
      user: verified.user,
    });
  } catch {
    res.status(500).json({ error: 'Không thể kiểm tra trạng thái đăng nhập.' });
  }
}

export async function postBootstrapAdmin(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const needsSetup = await needsInitialAdminSetup();
    if (!needsSetup) {
      res.status(403).json({
        error:
          'Hệ thống đã được khởi tạo quản trị viên. Không cho phép tự đăng ký tài khoản.',
      });
      return;
    }

    const username =
      typeof req.body?.username === 'string' ? req.body.username : '';
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const full_name =
      typeof req.body?.full_name === 'string' ? req.body.full_name : '';
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';

    const created = await createInitialAdminAccount({
      username,
      email,
      full_name,
      password,
    });

    await appendAuditLog({
      ma_ho_so: 'HE_THONG',
      tai_khoan: created.username,
      vai_tro: 'ADMIN',
      hanh_dong: 'KHOI_TAO_QUAN_TRI_BAN_DAU',
      noi_dung_truoc: {},
      noi_dung_sau: { username: created.username, role: created.role },
      ly_do: 'Khởi tạo tài khoản quản trị viên ban đầu',
    });

    res.status(201).json({
      ok: true,
      message: 'Đã khởi tạo tài khoản Quản trị viên ban đầu thành công.',
      user: created,
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg === 'ALREADY_INITIALIZED') {
      res.status(403).json({
        error: 'Tài khoản quản trị ban đầu đã tồn tại.',
      });
      return;
    }
    res.status(400).json({
      error: msg || 'Không thể khởi tạo tài khoản quản trị viên.',
    });
  }
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  try {
    const identifier =
      typeof req.body?.identifier === 'string' ? req.body.identifier : '';
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier.trim() || !password) {
      res.status(400).json({
        error: 'Vui lòng nhập tên đăng nhập (hoặc email) và mật khẩu.',
      });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const { user, token, expMs } = await authenticateUser({
      identifier,
      password,
      ip,
    });

    setSessionCookie(req, res, token, expMs);
    res.json({ ok: true, user });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg === 'ACCOUNT_LOCKED') {
      res.status(403).json({
        error:
          'Tài khoản này đã bị quản trị viên khóa. Vui lòng liên hệ quản trị viên.',
      });
      return;
    }
    if (msg.startsWith('RATE_LIMITED:')) {
      const mins = msg.split(':')[1] || '15';
      res.status(429).json({
        error: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${mins} phút.`,
      });
      return;
    }
    res.status(401).json({
      error: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
    });
  }
}

export async function postLogout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  await revokeSession(token);
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}
