#!/usr/bin/env node
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  const derivedBuffer = crypto.scryptSync(plainPassword, salt, 64);
  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (derivedBuffer.length !== originalBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuffer, originalBuffer);
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: node scripts/hash-password.mjs <password>');
    process.exit(1);
  }
  const hash = hashPassword(password);
  console.log('\n--- Admin Password Hash Generated ---');
  console.log(`Password: ${password}`);
  console.log(`Hash:     ${hash}`);
  console.log('\nSet this in your .env:');
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
}

