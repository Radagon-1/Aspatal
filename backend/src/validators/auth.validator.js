import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,13}$/).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['HOSPITAL_ADMIN', 'DOCTOR', 'ASHA_WORKER', 'PATIENT']).default('PATIENT'),
  name: z.string().min(2).optional(),
}).refine((d) => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((d) => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const phoneOTPSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,13}$/, 'Invalid phone number'),
});

export const verifyOTPSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,13}$/),
  otp: z.string().length(6),
});
