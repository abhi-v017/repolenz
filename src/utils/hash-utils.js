/**
 * Hash Utilities for RepoMap
 * Computes deterministic hashes and lightweight fingerprints for file tracking.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Computes a SHA-256 hash for a given string or Buffer.
 *
 * @param {string|Buffer} content - Raw content
 * @returns {string} Hexadecimal SHA-256 digest
 */
export function computeContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Computes a SHA-256 hash directly from a file stream.
 * Memory efficient: does not load the entire file into memory at once.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} Hexadecimal SHA-256 digest
 */
export function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Creates a fast filesystem fingerprint using size and last-modified timestamp.
 * Used for rapid preliminary change detection before computing full content hashes.
 *
 * @param {number} sizeBytes - File size in bytes
 * @param {number} mtimeMs - Modification timestamp in milliseconds
 * @returns {string} Fingerprint formatted as "${sizeBytes}:${mtimeMs}"
 */
export function computeFingerprint(sizeBytes, mtimeMs) {
  return `${sizeBytes}:${Math.floor(mtimeMs)}`;
}
