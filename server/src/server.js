const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const http = require('http');
const https = require('https');

// Import utilities and routes
const {
  ROOT_DIRECTORY,
  resolveSafePathWithSymlinkCheck,
  safeCompare,
  ensureRootExists,
} = require('./utils');
const {
  createAuthRoutes,
  createFileRoutes,
  createFolderRoutes,
  createTreeRoutes,
  createEntriesRoutes,
  createMetaRoutes,
  createSearchRoutes,
  createShareRoutes,
} = require('./routes');

const PORT = process.env.PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || 'false').toLowerCase() === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/certs/cert.pem';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/certs/key.pem';
const READ_ONLY_MODE = String(process.env.READ_ONLY_MODE || 'true').toLowerCase() !== 'false';
const MAX_PREVIEW_BYTES = Number(process.env.MAX_PREVIEW_BYTES || 1024 * 1024);
const IMAGE_PREVIEW_MAX_BYTES = Number(process.env.IMAGE_PREVIEW_MAX_BYTES || 2 * 1024 * 1024);
const THUMBNAIL_MAX_BYTES = Number(process.env.THUMBNAIL_MAX_BYTES || 256 * 1024);
const AUTH_USERNAME = process.env.EXPLORER_USERNAME;
const AUTH_PASSWORD_HASH = process.env.EXPLORER_PASSWORD_HASH; // bcrypt hash
const AUTH_PASSWORD_PLAIN = process.env.EXPLORER_PASSWORD; // deprecated, for backward compat
const NODE_ENV = process.env.NODE_ENV || 'development';

// Session secret validation
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET === 'change-me') {
  if (NODE_ENV === 'production') {
    console.error('FATAL: SESSION_SECRET must be set to a secure value in production');
    process.exit(1);
  }
  // Generate random secret for development
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: Using auto-generated SESSION_SECRET. Set SESSION_SECRET env var for persistence.');
}

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 3600);
const CLIENT_BUILD_DIR = path.resolve(__dirname, '../public');
const AUTH_REQUIRED = Boolean(AUTH_USERNAME && (AUTH_PASSWORD_HASH || AUTH_PASSWORD_PLAIN));
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'explorer_token';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'explorer_csrf';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const CORS_ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN;
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024); // 50MB default
const ALLOWED_UPLOAD_MIMES = (process.env.ALLOWED_UPLOAD_MIMES || '').split(',').filter(Boolean);

// Session version for invalidation (increment to invalidate all sessions)
let sessionVersion = 1;

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const parentPath = req.body.parentPath || '.';
      const resolved = await resolveSafePathWithSymlinkCheck(parentPath);
      cb(null, resolved);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename, sanitize to prevent path traversal
    const safeName = path.basename(file.originalname);
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const corsOptions = {
  origin: CORS_ALLOWED_ORIGIN || true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // max 200 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per window
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request ID middleware for traceability
function requestIdMiddleware(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// Audit logging
function auditLog(req, action, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    action,
    ip: req.ip,
    user: req.user?.username || 'anonymous',
    path: req.path,
    ...details,
  };
  console.log('[AUDIT]', JSON.stringify(logEntry));
}

app.use(requestIdMiddleware);
app.use('/api', apiLimiter);

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

function requireAuth(req, res, next) {
  if (!AUTH_REQUIRED) {
    return next();
  }
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (['/auth/login', '/auth/status', '/auth/logout', '/health'].includes(req.path)) {
    return next();
  }
  // Allow public access to share verification and content endpoints
  if (req.path.startsWith('/shares/') && (
    req.path.endsWith('/verify') ||
    req.path.endsWith('/content') ||
    req.path.endsWith('/download') ||
    req.path.endsWith('/entries') ||
    req.path.endsWith('/thumbnail') ||
    req.path.endsWith('/preview')
  )) {
    return next();
  }
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    // Verify session version for invalidation
    if (payload.sessionVersion !== sessionVersion) {
      return res.status(401).json({ error: 'Session has been invalidated.' });
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

app.use('/api', requireAuth);

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: COOKIE_SECURE,
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    sameSite: 'strict',
    secure: COOKIE_SECURE,
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: COOKIE_SECURE,
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: 'strict',
    secure: COOKIE_SECURE,
  });
}

// CSRF protection middleware for state-changing requests
function csrfProtection(req, res, next) {
  if (!AUTH_REQUIRED) {
    return next();
  }
  const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || !safeCompare(csrfCookie, csrfHeader)) {
    auditLog(req, 'CSRF_FAILURE', { csrfPresent: Boolean(csrfHeader) });
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }
  return next();
}

// Middleware to ensure server is not in read-only mode
function ensureWritable(req, res, next) {
  if (READ_ONLY_MODE) {
    return res.status(403).json({ error: 'Server is running in read-only mode.' });
  }
  return next();
}

// Session version helpers
function getSessionVersion() {
  return sessionVersion;
}

function incrementSessionVersion() {
  sessionVersion += 1;
  return sessionVersion;
}

// Shared route configuration
const routeConfig = {
  authRequired: AUTH_REQUIRED,
  authUsername: AUTH_USERNAME,
  storedPassword: AUTH_PASSWORD_HASH || AUTH_PASSWORD_PLAIN,
  sessionSecret: SESSION_SECRET,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
  getSessionVersion,
  incrementSessionVersion,
  setSessionCookie,
  setCsrfCookie,
  clearSessionCookie,
  extractToken,
  auditLog,
  csrfProtection,
  loginLimiter,
  ensureWritable,
  maxPreviewBytes: MAX_PREVIEW_BYTES,
  imagePreviewMaxBytes: IMAGE_PREVIEW_MAX_BYTES,
  thumbnailMaxBytes: THUMBNAIL_MAX_BYTES,
  maxUploadBytes: MAX_UPLOAD_BYTES,
  allowedUploadMimes: ALLOWED_UPLOAD_MIMES,
  upload,
  rootDirectory: ROOT_DIRECTORY,
  readOnly: READ_ONLY_MODE,
};

// Mount routes
app.use('/api/auth', createAuthRoutes(routeConfig));
app.use('/api', createMetaRoutes(routeConfig));
app.use('/api/tree', createTreeRoutes());
app.use('/api/file', createFileRoutes(routeConfig));
app.use('/api/files', createFileRoutes(routeConfig));
app.use('/api/folders', createFolderRoutes(routeConfig));
app.use('/api/entries', createEntriesRoutes(routeConfig));
app.use('/api/search', createSearchRoutes(routeConfig));
app.use('/api/shares', createShareRoutes(routeConfig));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.code === 'ENOENT') {
    return res.status(404).json({ error: 'Path not found.' });
  }
  if (err.message && err.message.includes('escapes the configured root')) {
    return res.status(400).json({ error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

// Serve static client files if available
if (fs.existsSync(CLIENT_BUILD_DIR)) {
  app.use(express.static(CLIENT_BUILD_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(path.join(CLIENT_BUILD_DIR, 'index.html'));
  });
}

async function start() {
  await ensureRootExists();
  
  if (HTTPS_ENABLED) {
    // Check if SSL certificates exist
    if (!fs.existsSync(SSL_CERT_PATH) || !fs.existsSync(SSL_KEY_PATH)) {
      console.error(`FATAL: HTTPS is enabled but SSL certificates not found at ${SSL_CERT_PATH} and ${SSL_KEY_PATH}`);
      process.exit(1);
    }
    
    const sslOptions = {
      cert: fs.readFileSync(SSL_CERT_PATH),
      key: fs.readFileSync(SSL_KEY_PATH),
    };
    
    // Start HTTPS server
    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
      console.log(`FileVue API listening on HTTPS port ${HTTPS_PORT}`);
    });
    
    // Optionally start HTTP server to redirect to HTTPS
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(301, `https://${req.headers.host.replace(/:\d+$/, '')}:${HTTPS_PORT}${req.url}`);
    });
    http.createServer(httpApp).listen(PORT, () => {
      console.log(`FileVue HTTP->HTTPS redirect server listening on port ${PORT}`);
    });
  } else {
    // Start HTTP server only
    app.listen(PORT, () => {
      console.log(`FileVue API listening on port ${PORT}`);
    });
  }
}

start();
