const express = require('express');
const jwt = require('jsonwebtoken');
const { safeCompare, verifyPassword, generateCsrfToken } = require('../utils');

const router = express.Router();

/**
 * Create auth routes with shared configuration.
 * @param {Object} config - Configuration object
 * @param {boolean} config.authRequired - Whether authentication is required
 * @param {string} config.authUsername - Expected username
 * @param {string} config.storedPassword - Stored password (hash or plain)
 * @param {string} config.sessionSecret - Secret for JWT signing
 * @param {number} config.sessionTtlSeconds - Session TTL in seconds
 * @param {Function} config.getSessionVersion - Function to get current session version
 * @param {Function} config.incrementSessionVersion - Function to increment session version
 * @param {Function} config.setSessionCookie - Function to set session cookie
 * @param {Function} config.setCsrfCookie - Function to set CSRF cookie
 * @param {Function} config.clearSessionCookie - Function to clear session cookies
 * @param {Function} config.extractToken - Function to extract token from request
 * @param {Function} config.auditLog - Audit logging function
 * @param {Function} config.csrfProtection - CSRF protection middleware
 * @param {Function} config.loginLimiter - Rate limiter for login attempts
 */
function createAuthRoutes(config) {
  const {
    authRequired,
    authUsername,
    storedPassword,
    sessionSecret,
    sessionTtlSeconds,
    getSessionVersion,
    incrementSessionVersion,
    setSessionCookie,
    setCsrfCookie,
    clearSessionCookie,
    extractToken,
    auditLog,
    csrfProtection,
    loginLimiter,
  } = config;

  router.get('/status', (req, res) => {
    if (!authRequired) {
      return res.json({ authRequired: false, authenticated: true, sessionTtlSeconds });
    }
    const token = extractToken(req);
    let authenticated = false;
    if (token) {
      try {
        const payload = jwt.verify(token, sessionSecret);
        // Check session version for invalidation
        if (payload.sessionVersion !== getSessionVersion()) {
          authenticated = false;
        } else {
          authenticated = true;
        }
      } catch (error) {
        authenticated = false;
      }
    }
    return res.json({ authRequired: true, authenticated, sessionTtlSeconds });
  });

  router.post('/login', loginLimiter, async (req, res) => {
    if (!authRequired) {
      return res.json({ authRequired: false });
    }
    const { username, password } = req.body || {};
    if (!username || !password) {
      auditLog(req, 'LOGIN_FAILURE', { reason: 'missing_credentials' });
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    
    // Constant-time username comparison
    const usernameMatch = safeCompare(username, authUsername);
    
    // Verify password (supports both hash and plain text)
    const passwordMatch = await verifyPassword(password, storedPassword);
    
    if (!usernameMatch || !passwordMatch) {
      auditLog(req, 'LOGIN_FAILURE', { reason: 'invalid_credentials', username });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const csrfToken = generateCsrfToken();
    const token = jwt.sign({ username, sessionVersion: getSessionVersion() }, sessionSecret, { expiresIn: sessionTtlSeconds });
    setSessionCookie(res, token);
    setCsrfCookie(res, csrfToken);
    auditLog(req, 'LOGIN_SUCCESS', { username });
    return res.json({ authenticated: true, expiresIn: sessionTtlSeconds, csrfToken });
  });

  router.post('/logout', (req, res) => {
    if (!authRequired) {
      return res.json({ authRequired: false });
    }
    auditLog(req, 'LOGOUT');
    clearSessionCookie(res);
    return res.json({ message: 'Logged out.' });
  });

  // Admin endpoint to invalidate all sessions
  router.post('/invalidate-sessions', csrfProtection, (req, res) => {
    if (!authRequired) {
      return res.json({ authRequired: false });
    }
    const newVersion = incrementSessionVersion();
    auditLog(req, 'SESSIONS_INVALIDATED', { newVersion });
    clearSessionCookie(res);
    return res.json({ message: 'All sessions invalidated.', newVersion });
  });

  return router;
}

module.exports = createAuthRoutes;
