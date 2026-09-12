import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Generate a JWT access token
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Generate a JWT refresh token
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * Parse expiry string to milliseconds (e.g., '7d' → 604800000)
 */
export function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 86400000);
}
