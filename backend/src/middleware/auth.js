const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const INSECURE_SECRETS = new Set([
  'change-me-in-production',
  'kle-dashboard-dev-secret-change-in-prod',
  'replace-with-a-secure-random-secret',
]);

if (!JWT_SECRET || INSECURE_SECRETS.has(JWT_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong, private value in backend/.env');
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

/**
 * Verifies the session token and attaches `req.user` with id, email, role.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = parseCookies(req.headers.cookie).auth_token;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Requires the authenticated user to have the 'admin' role.
 * Must be used AFTER authenticate().
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
