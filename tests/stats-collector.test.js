import { describe, it, expect } from 'vitest';
import { StatsCollector, formatBytes } from '../src/core/stats-collector.js';

describe('StatsCollector', () => {
  it('should format bytes cleanly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('should handle empty file lists gracefully', () => {
    const stats = StatsCollector.collect([]);
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalLinesOfCode).toBe(0);
    expect(stats.averageLinesPerFile).toBe(0);
    expect(stats.formattedTotalSize).toBe('0 B');
  });

  it('should calculate correct metrics across multiple files and languages', () => {
    const mockFiles = [
      {
        path: '/repo/src/a.js',
        relativePath: 'src/a.js',
        name: 'a.js',
        extension: '.js',
        language: 'javascript',
        sizeBytes: 1000,
        lineCount: 50
      },
      {
        path: '/repo/src/b.ts',
        relativePath: 'src/b.ts',
        name: 'b.ts',
        extension: '.ts',
        language: 'typescript',
        sizeBytes: 2000,
        lineCount: 150
      }
    ];

    const stats = StatsCollector.collect(mockFiles);

    expect(stats.totalFiles).toBe(2);
    expect(stats.totalLinesOfCode).toBe(200);
    expect(stats.totalSizeBytes).toBe(3000);
    expect(stats.averageLinesPerFile).toBe(100);

    expect(stats.languages.javascript.filesCount).toBe(1);
    expect(stats.languages.javascript.linesOfCode).toBe(50);
    expect(stats.languages.javascript.percentageLines).toBe(25);

    expect(stats.languages.typescript.filesCount).toBe(1);
    expect(stats.languages.typescript.linesOfCode).toBe(150);
    expect(stats.languages.typescript.percentageLines).toBe(75);

    expect(stats.largestFilesByLines[0].relativePath).toBe('src/b.ts');
  });
});
