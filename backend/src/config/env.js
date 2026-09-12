const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

for (const v of requiredVars) {
  if (!process.env[v]) {
    console.error(`❌ Missing required env variable: ${v}`);
    process.exit(1);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@aspatal.in',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',

  TRIAGE_ENGINE_URL: process.env.TRIAGE_ENGINE_URL || 'http://localhost:8000',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
