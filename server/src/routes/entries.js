const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const { resolveSafePathWithSymlinkCheck, ROOT_DIRECTORY } = require('../utils');

const router = express.Router();

/**
 * Create entries routes with shared configuration.
 * @param {Object} config - Configuration object
 * @param {Function} config.ensureWritable - Middleware to check writable mode
 * @param {Function} config.csrfProtection - CSRF protection middleware
 * @param {Function} config.auditLog - Audit logging function
 */
function createEntriesRoutes(config) {
  const { ensureWritable, csrfProtection, auditLog } = config;

  router.delete('/', ensureWritable, csrfProtection, async (req, res, next) => {
    try {
      const relativePath = req.query.path;
      if (!relativePath) {
        return res.status(400).json({ error: 'Query parameter "path" is required.' });
      }
      const targetPath = await resolveSafePathWithSymlinkCheck(relativePath);
      if (targetPath === ROOT_DIRECTORY) {
        return res.status(400).json({ error: 'Cannot delete the root directory.' });
      }
      await fsp.rm(targetPath, { recursive: true, force: true });
      auditLog(req, 'ENTRY_DELETED', { path: relativePath });
      return res.json({ message: 'Entry deleted.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createEntriesRoutes;
