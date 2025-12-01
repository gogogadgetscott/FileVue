const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const fsp = fs.promises;

const ROOT_DIRECTORY = path.resolve(process.env.ROOT_DIRECTORY || '/data');

/**
 * Resolve a relative path safely within the root directory.
 * Throws if the path escapes the configured root.
 */
function resolveSafePath(relativePath = '.') {
  const normalized = path.normalize(relativePath || '.');
  const resolved = path.resolve(ROOT_DIRECTORY, normalized);
  if (!resolved.startsWith(ROOT_DIRECTORY)) {
    throw new Error('Path escapes the configured root directory.');
  }
  return resolved;
}

/**
 * Resolve a path with symlink check to prevent escaping root via symlinks.
 */
async function resolveSafePathWithSymlinkCheck(relativePath = '.') {
  const resolved = resolveSafePath(relativePath);
  // Resolve symlinks to their real path and verify still within root
  let realPath;
  try {
    realPath = await fsp.realpath(resolved);
  } catch (err) {
    // If path doesn't exist yet (e.g., creating new file), check parent
    if (err.code === 'ENOENT') {
      const parentPath = path.dirname(resolved);
      const parentReal = await fsp.realpath(parentPath);
      if (!parentReal.startsWith(ROOT_DIRECTORY)) {
        throw new Error('Path escapes the configured root directory via symlink.');
      }
      return resolved;
    }
    throw err;
  }
  if (!realPath.startsWith(ROOT_DIRECTORY)) {
    throw new Error('Path escapes the configured root directory via symlink.');
  }
  return realPath;
}

/**
 * Get the relative path from root for an absolute path.
 */
function relativeFromRoot(absolutePath) {
  return path.relative(ROOT_DIRECTORY, absolutePath) || '.';
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do comparison to prevent timing leak on length
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a password using scrypt.
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
  return `scrypt:${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 * Supports both scrypt hash and plain text (backward compat).
 */
async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('scrypt:')) {
    const [, salt, hash] = storedHash.split(':');
    const derivedHash = await new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
    return safeCompare(derivedHash, hash);
  }
  // Plain text comparison (deprecated) with constant-time
  return safeCompare(password, storedHash);
}

/**
 * Generate a CSRF token.
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if a MIME type is an image type.
 */
function isImageMime(mimeType) {
  return Boolean(mimeType) && mimeType.startsWith('image/');
}

/**
 * Check if a MIME type is a text type.
 */
function isTextMime(mimeType) {
  if (!mimeType) {
    return false;
  }
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml'
  );
}

/**
 * Check if a file is an XMP file.
 */
function isXmpFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.xmp';
}

/**
 * Parse XMP properties from XML content.
 */
function parseXmpProperties(xmlContent) {
  const properties = [];
  // Match namespace prefixes and their URIs
  const nsRegex = /xmlns:([\w]+)="([^"]+)"/g;
  const namespaces = {};
  let nsMatch;
  while ((nsMatch = nsRegex.exec(xmlContent)) !== null) {
    namespaces[nsMatch[1]] = nsMatch[2];
  }
  
  // Match properties like <ns:PropertyName>value</ns:PropertyName>
  const propRegex = /<([\w]+):([\w]+)(?:\s[^>]*)?>([^<]*)<\/\1:\2>/g;
  let propMatch;
  while ((propMatch = propRegex.exec(xmlContent)) !== null) {
    const prefix = propMatch[1];
    const name = propMatch[2];
    const value = propMatch[3].trim();
    if (value && prefix !== 'rdf' && prefix !== 'x') {
      properties.push({
        namespace: namespaces[prefix] || prefix,
        name: name,
        value: value,
      });
    }
  }
  
  // Match self-closing properties with rdf:resource attribute
  const resourceRegex = /<([\w]+):([\w]+)\s+rdf:resource="([^"]+)"\s*\/>/g;
  while ((propMatch = resourceRegex.exec(xmlContent)) !== null) {
    const prefix = propMatch[1];
    const name = propMatch[2];
    const value = propMatch[3].trim();
    if (value && prefix !== 'rdf' && prefix !== 'x') {
      properties.push({
        namespace: namespaces[prefix] || prefix,
        name: name,
        value: value,
      });
    }
  }
  
  // Match alt/bag/seq items for structured properties
  const altRegex = /<([\w]+):([\w]+)>\s*<rdf:(?:Alt|Bag|Seq)>([\s\S]*?)<\/rdf:(?:Alt|Bag|Seq)>\s*<\/\1:\2>/g;
  while ((propMatch = altRegex.exec(xmlContent)) !== null) {
    const prefix = propMatch[1];
    const name = propMatch[2];
    const innerContent = propMatch[3];
    // Extract li values
    const liRegex = /<rdf:li[^>]*>([^<]*)<\/rdf:li>/g;
    let liMatch;
    const values = [];
    while ((liMatch = liRegex.exec(innerContent)) !== null) {
      if (liMatch[1].trim()) {
        values.push(liMatch[1].trim());
      }
    }
    if (values.length > 0 && prefix !== 'rdf' && prefix !== 'x') {
      properties.push({
        namespace: namespaces[prefix] || prefix,
        name: name,
        value: values.join(', '),
      });
    }
  }
  
  return properties;
}

/**
 * Check if buffer content is likely binary data.
 */
function isLikelyBinary(buffer) {
  const maxSample = Math.min(buffer.length, 512);
  for (let i = 0; i < maxSample; i += 1) {
    const charCode = buffer[i];
    if (charCode === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Ensure the root directory exists.
 */
function ensureRootExists() {
  return fsp.mkdir(ROOT_DIRECTORY, { recursive: true });
}

module.exports = {
  ROOT_DIRECTORY,
  resolveSafePath,
  resolveSafePathWithSymlinkCheck,
  relativeFromRoot,
  safeCompare,
  hashPassword,
  verifyPassword,
  generateCsrfToken,
  isImageMime,
  isTextMime,
  isXmpFile,
  parseXmpProperties,
  isLikelyBinary,
  ensureRootExists,
};
