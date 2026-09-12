import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseExpiry,
} from '../utils/token.js';
import { generateOTP, sendOTP, verifyOTP } from '../utils/otp.js';

// In-memory OTP store (use Redis in production)
const otpStore = new Map(); // phone -> { otp, expiresAt }

// ─── Helpers ───────────────────────────────────────────────
async function issueTokens(user, res) {
  const accessToken = generateAccessToken(user);
  const refreshTokenVal = generateRefreshToken(user);

  const expiresAt = new Date(Date.now() + parseExpiry(env.JWT_REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: { token: refreshTokenVal, userId: user.id, expiresAt },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return { accessToken, refreshToken: refreshTokenVal };
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── Register ──────────────────────────────────────────────
export async function register(req, res, next) {
  try {
    const { email, phone, password, role, name } = req.body;

    // Check uniqueness
    if (email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(409).json({ error: 'Email already registered' });
    }
    if (phone) {
      const exists = await prisma.user.findUnique({ where: { phone } });
      if (exists) return res.status(409).json({ error: 'Phone already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, phone, passwordHash, role },
    });

    const tokens = await issueTokens(user, res);
    res.status(201).json({ user: safeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// ─── Login ─────────────────────────────────────────────────
export async function login(req, res, next) {
  try {
    const { email, phone, password } = req.body;

    const user = await prisma.user.findUnique({
      where: email ? { email } : { phone },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tokens = await issueTokens(user, res);
    res.json({ user: safeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// ─── Admin Login ────────────────────────────────────────────
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid admin credentials' });

    const tokens = await issueTokens(user, res);
    res.json({ user: safeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// ─── Google OAuth Callback ─────────────────────────────────
export async function googleCallback(req, res, next) {
  try {
    const user = req.user;
    const tokens = await issueTokens(user, res);
    // Redirect to frontend with token (or respond with JSON for SPA)
    const redirectUrl = `${env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
}

// ─── Phone OTP ─────────────────────────────────────────────
export async function sendPhoneOTP(req, res, next) {
  try {
    const { phone } = req.body;
    const otp = generateOTP();
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min expiry
    await sendOTP(phone, otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
}

export async function verifyPhoneOTP(req, res, next) {
  try {
    const { phone, otp } = req.body;

    const stored = otpStore.get(phone);
    if (!stored || Date.now() > stored.expiresAt) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    const valid = await verifyOTP(phone, otp);
    if (!valid || stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    otpStore.delete(phone);

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { phone, role: 'PATIENT' } });
    }

    const tokens = await issueTokens(user, res);
    res.json({ user: safeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ─────────────────────────────────────────
export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token revoked or expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });
    const tokens = await issueTokens(user, res);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

// ─── Logout ────────────────────────────────────────────────
export async function logout(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ─── Get Current User ──────────────────────────────────────
export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, phone: true, role: true, isActive: true, lastLogin: true, createdAt: true,
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        ashaWorker: { select: { id: true, name: true, assignedArea: true } },
        hospitalAdmin: { select: { hospitalId: true } },
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}
