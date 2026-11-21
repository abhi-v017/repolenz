/**
 * Repository Statistics Collector for RepoMap
 *
 * Computes architectural metrics: total files, lines of code (LOC),
 * language distribution, and file size breakdowns.
 */

/**
 * Formats a raw byte count into a human-readable string.
 *
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size (e.g., "45.2 KB", "1.8 MB")
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export class StatsCollector {
  /**
   * Computes repository statistics from a list of scanned FileDescriptor objects.
   *
   * @param {import('./repository-scanner.js').FileDescriptor[]} files - Scanned file list
   * @returns {Object} Comprehensive statistics
   */
  static collect(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return {
        totalFiles: 0,
        totalLinesOfCode: 0,
        totalSizeBytes: 0,
        formattedTotalSize: '0 B',
        averageLinesPerFile: 0,
        languages: {},
        fileExtensions: {},
        largestFilesByLines: [],
        largestFilesBySize: []
      };
    }

    let totalLinesOfCode = 0;
    let totalSizeBytes = 0;
    const languages = {};
    const fileExtensions = {};

    for (const file of files) {
      totalLinesOfCode += file.lineCount;
      totalSizeBytes += file.sizeBytes;

      // Language breakdown
      const lang = file.language || 'unknown';
      if (!languages[lang]) {
        languages[lang] = {
          filesCount: 0,
          linesOfCode: 0,
          sizeBytes: 0,
          percentageFiles: 0,
          percentageLines: 0
        };
      }
      languages[lang].filesCount++;
      languages[lang].linesOfCode += file.lineCount;
      languages[lang].sizeBytes += file.sizeBytes;

      // Extension breakdown
      const ext = file.extension || 'none';
      fileExtensions[ext] = (fileExtensions[ext] || 0) + 1;
    }

    // Calculate percentage breakdown
    for (const lang of Object.keys(languages)) {
      const data = languages[lang];
      data.percentageFiles = Number(((data.filesCount / files.length) * 100).toFixed(1));
      data.percentageLines = totalLinesOfCode > 0
        ? Number(((data.linesOfCode / totalLinesOfCode) * 100).toFixed(1))
        : 0;
      data.formattedSize = formatBytes(data.sizeBytes);
    }

    // Top 5 largest files by line count
    const largestFilesByLines = [...files]
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 5)
      .map((f) => ({
        relativePath: f.relativePath,
        lineCount: f.lineCount,
        language: f.language
      }));

    // Top 5 largest files by byte size
    const largestFilesBySize = [...files]
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 5)
      .map((f) => ({
        relativePath: f.relativePath,
        sizeBytes: f.sizeBytes,
        formattedSize: formatBytes(f.sizeBytes)
      }));

    const averageLinesPerFile = files.length > 0
      ? Number((totalLinesOfCode / files.length).toFixed(1))
      : 0;

    return {
      totalFiles: files.length,
      totalLinesOfCode,
      totalSizeBytes,
      formattedTotalSize: formatBytes(totalSizeBytes),
      averageLinesPerFile,
      languages,
      fileExtensions,
      largestFilesByLines,
      largestFilesBySize
    };
  }
}
