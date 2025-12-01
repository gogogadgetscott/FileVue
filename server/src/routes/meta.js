const express = require('express');
const packageJson = require('../../package.json');

const router = express.Router();

/**
 * Create health and meta routes.
 * @param {Object} config - Configuration object
 * @param {string} config.rootDirectory - Root directory path
 * @param {boolean} config.readOnly - Whether in read-only mode
 * @param {number} config.maxPreviewBytes - Max preview bytes
 * @param {number} config.imagePreviewMaxBytes - Max image preview bytes
 * @param {number} config.thumbnailMaxBytes - Max thumbnail bytes
 */
function createMetaRoutes(config) {
  const {
    rootDirectory,
    readOnly,
    maxPreviewBytes,
    imagePreviewMaxBytes,
    thumbnailMaxBytes,
  } = config;

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  router.get('/meta', (req, res) => {
    res.json({
      version: packageJson.version,
      rootDirectory,
      readOnly,
      maxPreviewBytes,
      imagePreviewMaxBytes,
      thumbnailMaxBytes,
    });
  });

  return router;
}

module.exports = createMetaRoutes;
