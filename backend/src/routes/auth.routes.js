import { Router } from 'express';
import passport from 'passport';
import {
  register,
  login,
  googleCallback,
  sendPhoneOTP,
  verifyPhoneOTP,
  refreshToken,
  logout,
  getMe,
  adminLogin,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  phoneOTPSchema,
  verifyOTPSchema,
} from '../validators/auth.validator.js';

const router = Router();

// ─── Email / Password ──────────────────────────────────────
router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);

// ─── Admin ─────────────────────────────────────────────────
router.post('/admin/login', validate({ body: loginSchema }), adminLogin);

// ─── Google OAuth ──────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

// ─── Phone OTP ─────────────────────────────────────────────
router.post('/phone/send-otp', validate({ body: phoneOTPSchema }), sendPhoneOTP);
router.post('/phone/verify-otp', validate({ body: verifyOTPSchema }), verifyPhoneOTP);

// ─── Token Management ──────────────────────────────────────
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);

// ─── Current User ──────────────────────────────────────────
router.get('/me', authenticate, getMe);

export default router;
