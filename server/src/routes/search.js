const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const fsp = fs.promises;
const { resolveSafePathWithSymlinkCheck, relativeFromRoot, ROOT_DIRECTORY } = require('../utils');

const router = express.Router();

/**
 * Recursively search for files/folders matching the query.
 * @param {string} dirPath - Absolute path to search in
 * @param {string} query - Search query (case-insensitive)
 * @param {number} maxResults - Maximum number of results to return
 * @param {Array} results - Accumulator for results
 * @param {number} startTime - Search start timestamp
 * @param {number} timeout - Timeout in milliseconds
 * @param {Object} searchState - Mutable state object for tracking timeout
 * @returns {Promise<Array>} - Array of matching entries
 */
async function searchDirectory(dirPath, query, maxResults = 100, results = [], startTime = Date.now(), timeout = 10000, searchState = {}) {
  if (results.length >= maxResults) {
    return results;
  }

  // Check for timeout
  if (Date.now() - startTime > timeout) {
    searchState.timedOut = true;
    return results;
  }

  try {
    const dirents = await fsp.readdir(dirPath, { withFileTypes: true });
    const lowerQuery = query.toLowerCase();

    // Separate files and directories
    const files = [];
    const directories = [];
    for (const dirent of dirents) {
      if (dirent.isDirectory()) {
        directories.push(dirent);
      } else {
        files.push(dirent);
      }
    }

    // Process files first (to find matches in current directory quickly)
    for (const dirent of files) {
      if (results.length >= maxResults) {
        break;
      }

      // Check for timeout during iteration
      if (Date.now() - startTime > timeout) {
        searchState.timedOut = true;
        break;
      }

      const entryPath = path.join(dirPath, dirent.name);
      const lowerName = dirent.name.toLowerCase();

      // Check if name matches query
      if (lowerName.includes(lowerQuery)) {
        try {
          const stats = await fsp.stat(entryPath);
          const entryMime = mime.lookup(entryPath) || null;
          results.push({
            name: dirent.name,
            path: relativeFromRoot(entryPath),
            isDirectory: false,
            size: stats.size,
            modified: stats.mtimeMs,
            mimeType: entryMime,
          });
        } catch (statErr) {
          // Skip entries we can't stat
          continue;
        }
      }
    }

    // Then process directories - first check if directory name matches, then recurse
    for (const dirent of directories) {
      if (results.length >= maxResults) {
        break;
      }

      // Check for timeout during iteration
      if (Date.now() - startTime > timeout) {
        searchState.timedOut = true;
        break;
      }

      const entryPath = path.join(dirPath, dirent.name);
      const lowerName = dirent.name.toLowerCase();

      // Check if directory name matches query
      if (lowerName.includes(lowerQuery)) {
        try {
          const stats = await fsp.stat(entryPath);
          results.push({
            name: dirent.name,
            path: relativeFromRoot(entryPath),
            isDirectory: true,
            size: stats.size,
            modified: stats.mtimeMs,
            mimeType: null,
          });
        } catch (statErr) {
          // Skip entries we can't stat
        }
      }

      // Recursively search subdirectories
      try {
        await searchDirectory(entryPath, query, maxResults, results, startTime, timeout, searchState);
      } catch (recursiveErr) {
        // Skip directories we can't access
        continue;
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }

  return results;
}

/**
 * Create search routes.
 * @param {Object} config - Configuration object
 * @param {Function} config.auditLog - Audit logging function
 */
function createSearchRoutes(config) {
  const { auditLog } = config;

  /**
   * GET /api/search
   * Search for files and folders by name.
   * Query params:
   *   - q: Search query (required)
   *   - path: Path to search within (optional, defaults to root)
   *   - limit: Maximum results (optional, defaults to 100)
   */
  router.get('/', async (req, res, next) => {
    try {
      const startTime = Date.now();
      const query = req.query.q;
      const searchPath = req.query.path || '.';
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const timeout = Math.min(parseInt(req.query.timeout, 10) || 10000, 30000); // Max 30s timeout

      if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Query parameter "q" is required.' });
      }

      const targetPath = await resolveSafePathWithSymlinkCheck(searchPath);
      const stats = await fsp.stat(targetPath);

      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Search path must be a directory.' });
      }

      const searchState = { timedOut: false };
      const results = await searchDirectory(targetPath, query.trim(), limit, [], startTime, timeout, searchState);

      // Sort results: directories first, then by name
      results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      const durationMs = Date.now() - startTime;
      const truncated = results.length >= limit;

      if (auditLog) {
        auditLog(req, 'SEARCH', { query, path: searchPath, resultCount: results.length, durationMs });
      }

      return res.json({
        query,
        path: relativeFromRoot(targetPath),
        results,
        resultCount: results.length,
        truncated,
        timedOut: searchState.timedOut,
        durationMs,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createSearchRoutes;
