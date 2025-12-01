#!/usr/bin/env node
/**
 * Password hashing utility for FileVue
 * 
 * Usage: node hash-password.js <password>
 * 
 * This will output a scrypt hash that can be used in EXPLORER_PASSWORD_HASH env var.
 */

const crypto = require('crypto');

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

async function main() {
  const password = process.argv[2];
  
  if (!password) {
    console.error('Usage: node hash-password.js <password>');
    console.error('');
    console.error('Example:');
    console.error('  node hash-password.js "my-secure-password"');
    console.error('');
    console.error('Then set EXPLORER_PASSWORD_HASH in your environment:');
    console.error('  export EXPLORER_PASSWORD_HASH="scrypt:..."');
    process.exit(1);
  }
  
  const hash = await hashPassword(password);
  console.log('Password Hash:');
  console.log(hash);
  console.log('');
  console.log('Add to your .env file or environment:');
  console.log(`EXPLORER_PASSWORD_HASH=${hash}`);
}

main().catch(console.error);
