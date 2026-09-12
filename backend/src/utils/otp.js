import crypto from 'crypto';

/**
 * Generate a 6-digit OTP
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Stub: Send OTP via SMS
 * In production, integrate with Twilio / MSG91 / AWS SNS
 */
export async function sendOTP(phone, otp) {
  // TODO: Replace with actual SMS provider integration
  console.log(`📱 [OTP STUB] Sending OTP ${otp} to ${phone}`);
  return { success: true, message: 'OTP sent (stub)' };
}

/**
 * Stub: Verify OTP
 * In production, verify against a stored OTP in Redis/DB with expiry
 */
export async function verifyOTP(phone, otp) {
  // TODO: Replace with actual OTP verification
  // For demo, accept any 6-digit OTP or '123456'
  if (otp === '123456' || /^\d{6}$/.test(otp)) {
    console.log(`✅ [OTP STUB] Verified OTP for ${phone}`);
    return true;
  }
  return false;
}
