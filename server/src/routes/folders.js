const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { resolveSafePathWithSymlinkCheck, relativeFromRoot } = require('../utils');

const router = express.Router();

/**
 * Create folder routes with shared configuration.
 * @param {Object} config - Configuration object
 * @param {Function} config.ensureWritable - Middleware to check writable mode
 * @param {Function} config.csrfProtection - CSRF protection middleware
 * @param {Function} config.auditLog - Audit logging function
 */
function createFolderRoutes(config) {
  const { ensureWritable, csrfProtection, auditLog } = config;

  router.post('/', ensureWritable, csrfProtection, async (req, res, next) => {
    try {
      const { parentPath = '.', name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }
      const safeName = name.trim();
      if (!safeName) {
        return res.status(400).json({ error: 'Folder name cannot be empty.' });
      }
      const parentResolved = await resolveSafePathWithSymlinkCheck(parentPath);
      const destination = path.join(parentResolved, safeName);
      await fsp.mkdir(destination, { recursive: false });
      auditLog(req, 'FOLDER_CREATED', { folder: relativeFromRoot(destination) });
      return res.status(201).json({ message: 'Folder created.', path: relativeFromRoot(destination) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createFolderRoutes;
