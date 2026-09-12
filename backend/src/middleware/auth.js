import passport from 'passport';

/**
 * Middleware: Authenticate JWT token
 */
export const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: info?.message || 'Invalid or expired token',
      });
    }
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Middleware: Authorize by role(s)
 * @param  {...string} roles - Allowed roles (e.g., 'ADMIN', 'DOCTOR')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    }

    // ADMIN has access to everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${req.user.role}' does not have access to this resource. Required: ${roles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Middleware: Admin only
 */
export const adminOnly = authorize('ADMIN');
