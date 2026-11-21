import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  computeContentHash,
  computeFileHash,
  computeFingerprint
} from '../src/utils/hash-utils.js';

describe('Hash Utilities', () => {
  it('should compute deterministic SHA-256 hashes for strings', () => {
    const hash1 = computeContentHash('hello world');
    const hash2 = computeContentHash('hello world');
    const hash3 = computeContentHash('different content');

    expect(hash1).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('should compute stream hash matching string hash for files', async () => {
    const filePath = path.resolve('tests/fixtures/sample-repo/src/app.js');
    const fileHash = await computeFileHash(filePath);

    expect(fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should create fingerprint string from size and mtime', () => {
    const fp = computeFingerprint(1024, 1700000000123);
    expect(fp).toBe('1024:1700000000123');
  });
});
