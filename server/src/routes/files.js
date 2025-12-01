const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const fsp = fs.promises;
const {
  resolveSafePathWithSymlinkCheck,
  relativeFromRoot,
  isImageMime,
  isTextMime,
  isXmpFile,
  parseXmpProperties,
  isLikelyBinary,
} = require('../utils');

const router = express.Router();

/**
 * Create file routes with shared configuration.
 * @param {Object} config - Configuration object
 * @param {number} config.maxPreviewBytes - Max bytes for text preview
 * @param {number} config.imagePreviewMaxBytes - Max bytes for image preview
 * @param {number} config.thumbnailMaxBytes - Max bytes for thumbnails
 * @param {number} config.maxUploadBytes - Max upload file size
 * @param {string[]} config.allowedUploadMimes - Allowed MIME types for upload
 * @param {Function} config.ensureWritable - Middleware to check writable mode
 * @param {Function} config.csrfProtection - CSRF protection middleware
 * @param {Function} config.auditLog - Audit logging function
 * @param {Object} config.upload - Multer upload instance
 */
function createFileRoutes(config) {
  const {
    maxPreviewBytes,
    imagePreviewMaxBytes,
    thumbnailMaxBytes,
    maxUploadBytes,
    allowedUploadMimes,
    ensureWritable,
    csrfProtection,
    auditLog,
    upload,
  } = config;

  // File type validation for uploads
  function validateUploadFileType(file) {
    if (allowedUploadMimes.length === 0) {
      return true; // No restrictions configured
    }
    const fileMime = mime.lookup(file.originalname) || 'application/octet-stream';
    return allowedUploadMimes.some((allowed) => {
      if (allowed.endsWith('/*')) {
        const prefix = allowed.slice(0, -1);
        return fileMime.startsWith(prefix);
      }
      return fileMime === allowed;
    });
  }

  router.get('/content', async (req, res, next) => {
    try {
      const relativePath = req.query.path;
      if (!relativePath) {
        return res.status(400).json({ error: 'Query parameter "path" is required.' });
      }
      const filePath = await resolveSafePathWithSymlinkCheck(relativePath);
      const stats = await fsp.stat(filePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path resolves to a directory.' });
      }
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      const isImage = isImageMime(mimeType);
      const previewLimit = isImage ? imagePreviewMaxBytes : maxPreviewBytes;
      if (stats.size > previewLimit) {
        return res.status(413).json({
          error: 'File exceeds preview size limit.',
          size: stats.size,
          maxPreviewBytes: previewLimit,
        });
      }

      const buffer = await fsp.readFile(filePath);
      const basePayload = {
        name: path.basename(filePath),
        path: relativeFromRoot(filePath),
        size: stats.size,
        modified: stats.mtimeMs,
        mimeType,
      };

      // Handle XMP files specially - check BEFORE binary/text detection
      // since mime-types doesn't recognize .xmp extension
      if (isXmpFile(filePath)) {
        const textContent = buffer.toString('utf-8');
        const xmpProperties = parseXmpProperties(textContent);
        return res.json({
          ...basePayload,
          mimeType: 'application/rdf+xml', // XMP is RDF/XML
          encoding: 'utf-8',
          content: textContent,
          previewType: 'xmp',
          xmpProperties,
        });
      }

      if (isImage) {
        return res.json({
          ...basePayload,
          encoding: 'base64',
          content: buffer.toString('base64'),
          previewType: 'image',
        });
      }

      if (!isTextMime(mimeType) || isLikelyBinary(buffer)) {
        return res.json({
          ...basePayload,
          encoding: 'base64',
          content: buffer.toString('base64'),
          previewType: 'binary',
          note: 'Binary data shown as base64. Download for full inspection.',
        });
      }

      const textContent = buffer.toString('utf-8');

      return res.json({
        ...basePayload,
        encoding: 'utf-8',
        content: textContent,
        previewType: 'text',
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/thumbnail', async (req, res, next) => {
    try {
      const relativePath = req.query.path;
      if (!relativePath) {
        return res.status(400).json({ error: 'Query parameter "path" is required.' });
      }
      const filePath = await resolveSafePathWithSymlinkCheck(relativePath);
      const stats = await fsp.stat(filePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path resolves to a directory.' });
      }
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      if (!isImageMime(mimeType)) {
        return res.status(415).json({ error: 'Thumbnails are supported for images only.' });
      }
      if (stats.size > thumbnailMaxBytes) {
        return res.status(413).json({
          error: 'Image exceeds thumbnail size limit.',
          size: stats.size,
          maxPreviewBytes: thumbnailMaxBytes,
        });
      }
      const buffer = await fsp.readFile(filePath);
      return res.json({
        path: relativeFromRoot(filePath),
        mimeType,
        encoding: 'base64',
        content: buffer.toString('base64'),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/download', async (req, res, next) => {
    try {
      const relativePath = req.query.path;
      if (!relativePath) {
        return res.status(400).json({ error: 'Query parameter "path" is required.' });
      }
      const filePath = await resolveSafePathWithSymlinkCheck(relativePath);
      const stats = await fsp.stat(filePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Downloading directories is not supported.' });
      }
      return res.download(filePath);
    } catch (error) {
      return next(error);
    }
  });

  // Create new file endpoint (mounted at /api/files in server.js)
  router.post('/', ensureWritable, csrfProtection, async (req, res, next) => {
    try {
      const { parentPath = '.', name, content = '', encoding = 'utf-8' } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'File name is required.' });
      }
      const parentResolved = await resolveSafePathWithSymlinkCheck(parentPath);
      const destination = path.join(parentResolved, name);
      let buffer;
      if (encoding === 'base64') {
        buffer = Buffer.from(content, 'base64');
      } else {
        buffer = Buffer.from(content, 'utf-8');
      }
      await fsp.writeFile(destination, buffer, { flag: 'wx' });
      auditLog(req, 'FILE_CREATED', { file: relativeFromRoot(destination) });
      return res.status(201).json({ message: 'File created.', path: relativeFromRoot(destination) });
    } catch (error) {
      return next(error);
    }
  });

  // Upload files endpoint
  router.post('/upload', ensureWritable, csrfProtection, (req, res, next) => {
    upload.array('files', 10)(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File exceeds maximum size of ${maxUploadBytes} bytes.` });
        }
        return next(err);
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
      }
      
      // Validate file types
      for (const file of req.files) {
        if (!validateUploadFileType(file)) {
          // Delete uploaded files that failed validation
          await Promise.all(req.files.map((f) => fsp.unlink(f.path).catch(() => {})));
          auditLog(req, 'UPLOAD_REJECTED', { reason: 'invalid_file_type', filename: file.originalname });
          return res.status(415).json({ error: `File type not allowed: ${file.originalname}` });
        }
      }
      
      const uploaded = req.files.map((f) => ({
        name: f.filename,
        path: relativeFromRoot(f.path),
        size: f.size,
      }));
      auditLog(req, 'FILES_UPLOADED', { files: uploaded.map((f) => f.name) });
      return res.status(201).json({ message: 'Files uploaded.', files: uploaded });
    });
  });

  return router;
}

module.exports = createFileRoutes;
