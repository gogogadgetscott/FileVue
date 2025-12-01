const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const mime = require('mime-types');
const {
  resolveSafePathWithSymlinkCheck,
  relativeFromRoot,
  isImageMime,
  isTextMime,
  isLikelyBinary,
} = require('../utils');

const router = express.Router();

// In-memory store for shares (in production, use a database)
const shares = new Map();

// Default share expiration (24 hours)
const DEFAULT_SHARE_EXPIRY_HOURS = 24;
const MAX_SHARE_EXPIRY_HOURS = 168; // 7 days

/**
 * Generate a random share ID
 */
function generateShareId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Generate a random access code
 */
function generateAccessCode() {
  // 6-character alphanumeric code (easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0,O,1,I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Clean up expired shares
 */
function cleanupExpiredShares() {
  const now = Date.now();
  for (const [id, share] of shares) {
    if (share.expiresAt < now) {
      shares.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredShares, 5 * 60 * 1000);

/**
 * Create share routes.
 * @param {Object} config - Configuration object
 */
function createShareRoutes(config) {
  const {
    csrfProtection,
    maxPreviewBytes,
    imagePreviewMaxBytes,
  } = config;

  /**
   * POST /api/shares - Create a new share
   * Body: { path, expiresInHours? }
   * Returns: { shareId, accessCode, shareUrl, expiresAt }
   */
  router.post('/', csrfProtection, async (req, res, next) => {
    try {
      const { path: targetPath, expiresInHours = DEFAULT_SHARE_EXPIRY_HOURS } = req.body;

      if (!targetPath) {
        return res.status(400).json({ error: 'Path is required.' });
      }

      // Validate expiry
      const expiry = Math.min(Math.max(1, Number(expiresInHours) || DEFAULT_SHARE_EXPIRY_HOURS), MAX_SHARE_EXPIRY_HOURS);

      // Verify path exists and is within root
      const resolvedPath = await resolveSafePathWithSymlinkCheck(targetPath);
      const stats = await fsp.stat(resolvedPath);

      const shareId = generateShareId();
      const accessCode = generateAccessCode();
      const expiresAt = Date.now() + (expiry * 60 * 60 * 1000);

      const share = {
        id: shareId,
        accessCode,
        path: targetPath,
        resolvedPath,
        isDirectory: stats.isDirectory(),
        name: path.basename(resolvedPath),
        createdAt: Date.now(),
        expiresAt,
        accessCount: 0,
      };

      shares.set(shareId, share);

      // Build share URL (client will construct full URL)
      const shareUrl = `/share/${shareId}`;

      return res.json({
        shareId,
        accessCode,
        shareUrl,
        expiresAt,
        expiresIn: `${expiry} hours`,
        name: share.name,
        isDirectory: share.isDirectory,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/shares/:shareId/verify - Verify access code and get share info
   * Query: code
   */
  router.get('/:shareId/verify', async (req, res, next) => {
    try {
      const { shareId } = req.params;
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({ error: 'Access code is required.' });
      }

      const share = shares.get(shareId);

      if (!share) {
        return res.status(404).json({ error: 'Share not found or expired.' });
      }

      if (share.expiresAt < Date.now()) {
        shares.delete(shareId);
        return res.status(404).json({ error: 'Share has expired.' });
      }

      // Constant-time comparison to prevent timing attacks
      const codeBuffer = Buffer.from(code.toUpperCase());
      const storedBuffer = Buffer.from(share.accessCode);
      if (codeBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(codeBuffer, storedBuffer)) {
        return res.status(403).json({ error: 'Invalid access code.' });
      }

      // Generate a temporary access token for this share session
      const accessToken = crypto.randomBytes(16).toString('hex');
      share.accessTokens = share.accessTokens || new Set();
      share.accessTokens.add(accessToken);
      share.accessCount++;

      // Verify path still exists
      try {
        await fsp.stat(share.resolvedPath);
      } catch (err) {
        return res.status(404).json({ error: 'Shared content no longer exists.' });
      }

      return res.json({
        valid: true,
        accessToken,
        name: share.name,
        isDirectory: share.isDirectory,
        expiresAt: share.expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * Middleware to verify share access token
   */
  function verifyShareAccess(req, res, next) {
    const { shareId } = req.params;
    const accessToken = req.headers['x-share-token'];

    if (!accessToken) {
      return res.status(401).json({ error: 'Share access token required.' });
    }

    const share = shares.get(shareId);

    if (!share) {
      return res.status(404).json({ error: 'Share not found or expired.' });
    }

    if (share.expiresAt < Date.now()) {
      shares.delete(shareId);
      return res.status(404).json({ error: 'Share has expired.' });
    }

    if (!share.accessTokens || !share.accessTokens.has(accessToken)) {
      return res.status(403).json({ error: 'Invalid share access token.' });
    }

    req.share = share;
    return next();
  }

  /**
   * GET /api/shares/:shareId/content - Get shared file content or folder listing
   * Query: path (for subdirectories when sharing a folder)
   */
  router.get('/:shareId/content', verifyShareAccess, async (req, res, next) => {
    try {
      const { share } = req;
      const subPath = req.query.path || '.';

      let targetPath;
      if (share.isDirectory) {
        // Allow navigating within shared directory
        const normalizedSubPath = path.normalize(subPath);
        if (normalizedSubPath.startsWith('..')) {
          return res.status(400).json({ error: 'Cannot access paths outside shared directory.' });
        }
        targetPath = path.join(share.resolvedPath, normalizedSubPath);
        // Ensure still within shared directory
        if (!targetPath.startsWith(share.resolvedPath)) {
          return res.status(400).json({ error: 'Cannot access paths outside shared directory.' });
        }
      } else {
        // Sharing a single file
        targetPath = share.resolvedPath;
      }

      const stats = await fsp.stat(targetPath);

      if (stats.isDirectory()) {
        // Return directory listing
        const items = await fsp.readdir(targetPath, { withFileTypes: true });
        const entries = await Promise.all(
          items.map(async (item) => {
            const itemPath = path.join(targetPath, item.name);
            const itemStats = await fsp.stat(itemPath).catch(() => null);
            return {
              name: item.name,
              path: path.relative(share.resolvedPath, itemPath),
              isDirectory: item.isDirectory(),
              size: itemStats?.size || 0,
              modified: itemStats?.mtimeMs || 0,
              mimeType: item.isDirectory() ? null : mime.lookup(item.name) || null,
            };
          })
        );

        return res.json({
          type: 'directory',
          name: path.basename(targetPath),
          path: path.relative(share.resolvedPath, targetPath) || '.',
          entries: entries.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        });
      }

      // Return file content
      const mimeType = mime.lookup(targetPath) || 'application/octet-stream';
      const isImage = isImageMime(mimeType);
      const previewLimit = isImage ? imagePreviewMaxBytes : maxPreviewBytes;

      if (stats.size > previewLimit) {
        return res.json({
          type: 'file',
          name: path.basename(targetPath),
          path: path.relative(share.resolvedPath, targetPath) || path.basename(targetPath),
          size: stats.size,
          mimeType,
          previewType: 'too-large',
          note: 'File too large for preview. Use download.',
        });
      }

      const buffer = await fsp.readFile(targetPath);

      if (isImage) {
        return res.json({
          type: 'file',
          name: path.basename(targetPath),
          path: path.relative(share.resolvedPath, targetPath) || path.basename(targetPath),
          size: stats.size,
          mimeType,
          previewType: 'image',
          encoding: 'base64',
          content: buffer.toString('base64'),
        });
      }

      if (!isTextMime(mimeType) || isLikelyBinary(buffer)) {
        return res.json({
          type: 'file',
          name: path.basename(targetPath),
          path: path.relative(share.resolvedPath, targetPath) || path.basename(targetPath),
          size: stats.size,
          mimeType,
          previewType: 'binary',
          encoding: 'base64',
          content: buffer.toString('base64'),
        });
      }

      return res.json({
        type: 'file',
        name: path.basename(targetPath),
        path: path.relative(share.resolvedPath, targetPath) || path.basename(targetPath),
        size: stats.size,
        mimeType,
        previewType: 'text',
        encoding: 'utf-8',
        content: buffer.toString('utf-8'),
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/shares/:shareId/download - Download shared file
   * Query: path (for files within shared folder)
   */
  router.get('/:shareId/download', verifyShareAccess, async (req, res, next) => {
    try {
      const { share } = req;
      const subPath = req.query.path || '.';

      let targetPath;
      if (share.isDirectory) {
        const normalizedSubPath = path.normalize(subPath);
        if (normalizedSubPath.startsWith('..')) {
          return res.status(400).json({ error: 'Cannot access paths outside shared directory.' });
        }
        targetPath = path.join(share.resolvedPath, normalizedSubPath);
        if (!targetPath.startsWith(share.resolvedPath)) {
          return res.status(400).json({ error: 'Cannot access paths outside shared directory.' });
        }
      } else {
        targetPath = share.resolvedPath;
      }

      const stats = await fsp.stat(targetPath);

      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Cannot download directories directly.' });
      }

      const mimeType = mime.lookup(targetPath) || 'application/octet-stream';
      const fileName = path.basename(targetPath);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', stats.size);

      const stream = fs.createReadStream(targetPath);
      stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  });

  /**
   * DELETE /api/shares/:shareId - Delete a share (requires auth)
   */
  router.delete('/:shareId', csrfProtection, async (req, res, next) => {
    try {
      const { shareId } = req.params;
      
      if (shares.has(shareId)) {
        shares.delete(shareId);
        return res.json({ success: true, message: 'Share deleted.' });
      }

      return res.status(404).json({ error: 'Share not found.' });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/shares - List active shares (requires auth)
   */
  router.get('/', async (req, res, next) => {
    try {
      cleanupExpiredShares();
      
      const activeShares = Array.from(shares.values()).map(share => ({
        id: share.id,
        name: share.name,
        path: share.path,
        isDirectory: share.isDirectory,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        accessCount: share.accessCount,
      }));

      return res.json({ shares: activeShares });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createShareRoutes;
