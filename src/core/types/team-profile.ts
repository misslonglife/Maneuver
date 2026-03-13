/**
 * Team Profile Type Definition
 *
 * SINGLE SOURCE OF TRUTH for team metadata from TBA and Statbotics.
 * Consolidates:
 * - Basic info from TBA (team number, name, country, city, state)
 * - Rankings from Statbotics (global rank + event-specific ranks)
 * - Competition history from TBA match results (wins/losses/ties, ranking trends)
 *
 * This is the unified structure stored in TeamDB.
 * No game-specific fields (this is framework-level, year-agnostic).
 */

/**
 * Competition result for a single event
 */
export interface CompetitionRecord {
  eventKey: string; // e.g., "2026mrcmp"
  eventName?: string; // Human-readable event name
  wins: number; // Number of wins at this event
  losses: number; // Number of losses at this event
  ties: number; // Number of ties at this event
  winRate?: number; // Computed: wins / (wins + losses + ties)
  avgRank?: number; // Average finish ranking (lower is better)
  bestRank?: number; // Best (lowest) finish ranking
  statboticsRank?: number; // Rank at this specific event per Statbotics
  statboticsPercentile?: number; // Percentile at this specific event
}

/**
 * Statbotics ranking data (global and event-specific)
 */
export interface StatboticsRanking {
  globalRank: number; // Overall rank across all teams
  globalPercentile: number; // Percentile (0-100)
  eventRank?: number; // Rank within a specific event (if provided at fetch time)
  eventPercentile?: number; // Percentile within event
}

/**
 * Complete team profile - unified team metadata
 *
 * Stored in TeamDB, indexed by teamNumber.
 * Single source of truth combining:
 * 1. TBA team info (name, country, city, state)
 * 2. Statbotics current ranking (global + event-specific)
 * 3. Competition history (wins/losses/trends across 2026 events)
 */
export interface TeamProfile {
  // ========================================================================
  // IDENTIFICATION & BASIC INFO (from TBA)
  // ========================================================================

  teamNumber: number; // Primary key: e.g., 3314
  name: string; // Team name from TBA
  nickname?: string; // Team nickname from TBA (usually same as name)
  country?: string; // Country from TBA
  state?: string; // State/Province from TBA
  city?: string; // City from TBA
  schoolName?: string; // School name from TBA (if available)

  // ========================================================================
  // STATBOTICS RANKINGS
  // ========================================================================

  statbotics?: StatboticsRanking; // Current global + event-specific ranks
  statboticsLastUpdatedAt?: number; // Timestamp when Statbotics data was refreshed

  // ========================================================================
  // COMPETITION HISTORY (from TBA match results)
  // ========================================================================

  competitionHistory: CompetitionRecord[]; // Array of competition results per event
  // Computed aggregate stats:
  aggregateWins?: number; // Total wins across all events in competitionHistory
  aggregateLosses?: number; // Total losses across all events
  aggregateTies?: number; // Total ties across all events
  avgRankTrend?: number; // Average of all avgRank values (improvement/decline indicator)

  // ========================================================================
  // METADATA
  // ========================================================================

  createdAt: number; // Timestamp when profile was first created
  lastUpdatedAt: number; // Timestamp when profile was last updated
  dataSource: 'tba' | 'statbotics' | 'merged'; // Where did this data come from?
}

/**
 * Type for fetching and merging team data from external sources
 */
export interface TeamDataFetchResult {
  teamNumber: number;
  tbaData?: {
    name: string;
    nickname?: string;
    country?: string;
    state?: string;
    city?: string;
    schoolName?: string;
  };
  statboticsData?: StatboticsRanking;
  competitionHistory?: CompetitionRecord[];
}
