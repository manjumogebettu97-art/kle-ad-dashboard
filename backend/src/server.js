require('dotenv').config();
const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');

const authRouter      = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const settingsRouter  = require('./routes/settings');

const app  = express();
const PORT = process.env.PORT || 5000;

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  skipSuccessfulRequests: true,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/auth/login', authLoginLimiter);
app.use('/api/auth/register', authLoginLimiter);

app.use(express.json());

// Serve ad creative images: GET /assets/<folder>/<filename>
const IMPORTS_DIR = path.join(__dirname, '../data/imports');
app.use('/assets', express.static(IMPORTS_DIR, {
  maxAge: '7d',
  fallthrough: true,
}));

app.use('/api/auth',      authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings',  settingsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const FRONTEND_BUILD_DIR = path.join(__dirname, '../../frontend/build');
if (fs.existsSync(FRONTEND_BUILD_DIR)) {
  app.use(express.static(FRONTEND_BUILD_DIR, { maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) return next();
    res.sendFile(path.join(FRONTEND_BUILD_DIR, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
