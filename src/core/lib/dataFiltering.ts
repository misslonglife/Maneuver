/**
 * Data Filtering Utilities
 * Reduces large event data transfers from 74-190 QR codes to <40 codes
 */

import type { ScoutingDataExport } from '../types/scouting-entry';
import * as pako from 'pako';
import { benchmarkCompressionVariants } from './compressionBenchmark';
import { getFountainEstimate } from './fountainUtils';

/**
 * Type alias for data collections used in filtering
 */
export type ScoutingDataCollection = ScoutingDataExport;

// Filtering interfaces
export interface MatchRangeFilter {
  type: 'preset' | 'custom';
  preset?: 'last10' | 'last15' | 'last30' | 'all' | 'fromLastExport';
  customStart?: number;
  customEnd?: number;
}

export interface TeamFilter {
  selectedTeams: string[]; // Team numbers as strings
  includeAll: boolean;
}

export interface DataFilters {
  matchRange: MatchRangeFilter;
  teams: TeamFilter;
}

export interface FilteredDataStats {
  originalEntries: number;
  filteredEntries: number;
  estimatedQRCodes: number;
  estimatedFountainPackets: number;
  actualJsonBytes: number;
  actualCompressedBytes: number;
  avgBytesPerEntry: number;
  estimatedFountainPacketsFast: number;
  estimatedFountainPacketsReliable: number;
  benchmarkBestMethod?: string;
  benchmarkBestBytes?: number;
  benchmarkBestPackets?: number;
  benchmarkReductionPct?: number;
  compressionReduction?: string;
  scanTimeEstimate: string;
  warningLevel: 'safe' | 'warning' | 'danger';
}

/**
 * Track the last exported match for "from last export" filtering
 */
const LAST_EXPORTED_MATCH_KEY = 'maneuver_last_exported_match';

export function getLastExportedMatch(): number | null {
  try {
    const stored = localStorage.getItem(LAST_EXPORTED_MATCH_KEY);
    return stored ? parseInt(stored) : null;
  } catch {
    return null;
  }
}

export function setLastExportedMatch(matchNumber: number): void {
  try {
    localStorage.setItem(LAST_EXPORTED_MATCH_KEY, matchNumber.toString());
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Extract unique team numbers from scouting data
 */
export function extractTeamNumbers(data: ScoutingDataCollection): string[] {
  const teams = new Set<string>();

  data.entries.forEach(entry => {
    if (entry.teamNumber) {
      teams.add(String(entry.teamNumber));
    }
  });

  return Array.from(teams).sort((a, b) => {
    // Sort numerically if both are numbers, otherwise alphabetically
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}

/**
 * Extract match number range from scouting data
 */
export function extractMatchRange(data: ScoutingDataCollection): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  data.entries.forEach(entry => {
    const matchNum = entry.matchNumber;
    if (matchNum) {
      min = Math.min(min, matchNum);
      max = Math.max(max, matchNum);
    }
  });

  return {
    min: min === Infinity ? 1 : min,
    max: max === -Infinity ? 1 : max,
  };
}

/**
 * Apply filters to scouting data
 */
export function applyFilters(
  data: ScoutingDataCollection,
  filters: DataFilters
): ScoutingDataCollection {
  let filteredEntries = data.entries;

  // Apply team filter
  if (!filters.teams.includeAll && filters.teams.selectedTeams.length > 0) {
    filteredEntries = filteredEntries.filter(entry =>
      filters.teams.selectedTeams.includes(String(entry.teamNumber))
    );
  }

  // Apply match range filter
  if (filters.matchRange.type === 'preset' && filters.matchRange.preset !== 'all') {
    const matchRange = extractMatchRange(data);
    let startMatch = matchRange.min;

    if (filters.matchRange.preset === 'last10') {
      startMatch = Math.max(matchRange.min, matchRange.max - 9);
    } else if (filters.matchRange.preset === 'last15') {
      startMatch = Math.max(matchRange.min, matchRange.max - 14);
    } else if (filters.matchRange.preset === 'last30') {
      startMatch = Math.max(matchRange.min, matchRange.max - 29);
    } else if (filters.matchRange.preset === 'fromLastExport') {
      const lastExportedMatch = getLastExportedMatch();
      startMatch = lastExportedMatch
        ? Math.max(matchRange.min, lastExportedMatch + 1)
        : matchRange.min;
    }

    filteredEntries = filteredEntries.filter(entry => {
      const matchNum = entry.matchNumber;
      return matchNum >= startMatch && matchNum <= matchRange.max;
    });
  } else if (filters.matchRange.type === 'custom') {
    const start = filters.matchRange.customStart || 1;
    const end = filters.matchRange.customEnd || 999;

    filteredEntries = filteredEntries.filter(entry => {
      const matchNum = entry.matchNumber;
      return matchNum >= start && matchNum <= end;
    });
  }

  return {
    ...data,
    entries: filteredEntries,
  };
}

/**
 * Estimate QR codes and generate statistics for filtered data
 */
export function calculateFilterStats(
  originalData: ScoutingDataCollection,
  filteredData: ScoutingDataCollection,
  useCompression: boolean = true
): FilteredDataStats {
  const originalEntries = originalData.entries.length;
  const filteredEntries = filteredData.entries.length;

  // Measure actual payload size from the current filtered dataset
  const filteredJson = JSON.stringify(filteredData);
  const actualJsonBytes = new TextEncoder().encode(filteredJson).length;
  const actualCompressedBytes = useCompression ? pako.gzip(filteredJson).length : actualJsonBytes;
  const transferBytes = useCompression ? actualCompressedBytes : actualJsonBytes;

  // QR estimate (2KB target payload per code)
  const estimatedQRCodes = Math.ceil(transferBytes / 2000);

  // Fountain estimate mirrors UniversalFountainGenerator settings
  const estimatedFountainPacketsFast = getFountainEstimate(transferBytes, 'fast').targetPackets;
  const estimatedFountainPacketsReliable = getFountainEstimate(
    transferBytes,
    'reliable'
  ).targetPackets;
  const estimatedFountainPackets = estimatedFountainPacketsFast;
  const avgBytesPerEntry = filteredEntries > 0 ? Math.round(transferBytes / filteredEntries) : 0;

  // Estimate one full cycle at default speed (500ms per packet)
  const scanTimeSeconds = Math.round(estimatedFountainPackets * 0.5);
  const scanTimeMinutes = Math.floor(scanTimeSeconds / 60);
  const remainingSeconds = scanTimeSeconds % 60;

  let scanTimeEstimate: string;
  if (scanTimeMinutes > 0) {
    scanTimeEstimate = `~${scanTimeMinutes}m ${remainingSeconds}s`;
  } else {
    scanTimeEstimate = `~${scanTimeSeconds}s`;
  }

  // Determine warning level
  let warningLevel: 'safe' | 'warning' | 'danger';
  if (estimatedFountainPackets <= 80) {
    warningLevel = 'safe';
  } else if (estimatedFountainPackets <= 160) {
    warningLevel = 'warning';
  } else {
    warningLevel = 'danger';
  }

  // Compression reduction info
  let compressionReduction: string | undefined;
  let benchmarkBestMethod: string | undefined;
  let benchmarkBestBytes: number | undefined;
  let benchmarkBestPackets: number | undefined;
  let benchmarkReductionPct: number | undefined;

  if (useCompression) {
    const benchmark = benchmarkCompressionVariants(filteredData);
    const best = benchmark.bestVariant;

    if (best.gzipBytes < actualCompressedBytes) {
      benchmarkBestMethod = best.name;
      benchmarkBestBytes = best.gzipBytes;
      benchmarkBestPackets = best.estimatedFountainPackets;
      benchmarkReductionPct = Number(
        (((actualCompressedBytes - best.gzipBytes) / actualCompressedBytes) * 100).toFixed(1)
      );
    }
  }

  if (useCompression) {
    const originalJson = JSON.stringify(originalData);
    const originalBytes = new TextEncoder().encode(originalJson).length;
    const compressedOriginalBytes = pako.gzip(originalJson).length;
    if (originalBytes > 0) {
      const reduction = ((1 - compressedOriginalBytes / originalBytes) * 100).toFixed(1);
      compressionReduction = `${reduction}% smaller payload with compression`;
    }
  }

  return {
    originalEntries,
    filteredEntries,
    estimatedQRCodes,
    estimatedFountainPackets,
    actualJsonBytes,
    actualCompressedBytes,
    avgBytesPerEntry,
    estimatedFountainPacketsFast,
    estimatedFountainPacketsReliable,
    benchmarkBestMethod,
    benchmarkBestBytes,
    benchmarkBestPackets,
    benchmarkReductionPct,
    compressionReduction,
    scanTimeEstimate,
    warningLevel,
  };
}

/**
 * Create default filters (smart default based on export history)
 */
export function createDefaultFilters(): DataFilters {
  const lastExported = getLastExportedMatch();
  const defaultPreset = lastExported !== null ? 'fromLastExport' : 'all';

  return {
    matchRange: {
      type: 'preset',
      preset: defaultPreset,
    },
    teams: {
      selectedTeams: [],
      includeAll: true,
    },
  };
}

/**
 * Validate filter configuration
 */
export function validateFilters(filters: DataFilters): { valid: boolean; error?: string } {
  if (filters.matchRange.type === 'custom') {
    const start = filters.matchRange.customStart;
    const end = filters.matchRange.customEnd;

    if (start !== undefined && end !== undefined && start > end) {
      return { valid: false, error: 'Start match must be less than or equal to end match' };
    }

    if (start !== undefined && (start < 1 || start > 200)) {
      return { valid: false, error: 'Start match must be between 1 and 200' };
    }

    if (end !== undefined && (end < 1 || end > 200)) {
      return { valid: false, error: 'End match must be between 1 and 200' };
    }
  }

  return { valid: true };
}
