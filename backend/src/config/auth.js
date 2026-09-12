import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './db.js';
import { env } from './env.js';

export function configurePassport(passport) {
  // ─── JWT Strategy ────────────────────────────────────────
  const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(jwtOpts, async (payload, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return done(null, false);
        }

        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    })
  );

  // ─── Google OAuth Strategy ───────────────────────────────
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'), false);
            }

            // Find or create user
            let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

            if (!user) {
              // Check if email already exists
              user = await prisma.user.findUnique({ where: { email } });
              if (user) {
                // Link Google account to existing user
                user = await prisma.user.update({
                  where: { id: user.id },
                  data: { googleId: profile.id },
                });
              } else {
                // Create new user
                user = await prisma.user.create({
                  data: {
                    email,
                    googleId: profile.id,
                    role: 'PATIENT', // default role, can be upgraded by admin
                  },
                });
              }
            }

            return done(null, user);
          } catch (err) {
            return done(err, false);
          }
        }
      )
    );
  }
}
