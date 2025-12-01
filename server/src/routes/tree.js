const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const fsp = fs.promises;
const { resolveSafePathWithSymlinkCheck, relativeFromRoot } = require('../utils');

const router = express.Router();

/**
 * Get directory entries sorted with directories first.
 */
async function getDirectoryEntries(targetPath) {
  const dirents = await fsp.readdir(targetPath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      const entryPath = path.join(targetPath, dirent.name);
      const stats = await fsp.stat(entryPath);
      const entryMime = dirent.isDirectory() ? null : mime.lookup(entryPath) || null;
      return {
        name: dirent.name,
        path: relativeFromRoot(entryPath),
        isDirectory: dirent.isDirectory(),
        size: stats.size,
        modified: stats.mtimeMs,
        mimeType: entryMime,
      };
    })
  );

  return entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Create tree routes.
 */
function createTreeRoutes() {
  router.get('/', async (req, res, next) => {
    try {
      const relativePath = req.query.path || '.';
      const targetPath = await resolveSafePathWithSymlinkCheck(relativePath);
      const stats = await fsp.stat(targetPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path must identify a directory.' });
      }
      const entries = await getDirectoryEntries(targetPath);
      return res.json({
        path: relativeFromRoot(targetPath),
        entries,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createTreeRoutes;
