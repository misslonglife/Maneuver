/**
 * Statbotics Team Ranking Utilities
 * 
 * Fetches and caches team rankings from Statbotics API.
 * Provides both global rankings and event-specific rankings.
 */

import { proxyGetJson } from '@/core/lib/apiProxy';
import type { StatboticsRanking } from '@/core/types/team-profile';

/**
 * Statbotics team ranking response structure
 */
interface StatboticsTeamResponse {
  team?: number;
  name?: string;
  event?: string;
  year?: number;
  rank?: {
    rank?: number;
    percentile?: number;
  };
  epa?: {
    breakdown?: Record<string, unknown>;
  };
}

interface StatboticsTeamYearResponse {
  team?: number;
  year?: number;
  rank?: {
    rank?: number;
    percentile?: number;
  };
}

/**
 * Fetch global team ranking from Statbotics (across all teams for a given year)
 * Returns both rank and percentile
 */
export const fetchTeamGlobalRanking = async (
  teamNumber: number,
  year: number = 2026
): Promise<StatboticsRanking | null> => {
  try {
    const response = await proxyGetJson<StatboticsTeamYearResponse>(
      'statbotics',
      `/team/${teamNumber}/${year}`
    );

    if (!response?.rank?.rank || response.rank.percentile === undefined) {
      console.warn(`No global ranking data for team ${teamNumber} in ${year}`);
      return null;
    }

    return {
      globalRank: response.rank.rank,
      globalPercentile: response.rank.percentile,
    };
  } catch (error) {
    console.warn(
      `[Statbotics] Failed to fetch global ranking for team ${teamNumber}:`,
      error
    );
    return null;
  }
};

/**
 * Fetch event-specific team ranking from Statbotics
 * Returns rank and percentile for a specific event
 */
export const fetchTeamEventRanking = async (
  teamNumber: number,
  eventKey: string
): Promise<Omit<StatboticsRanking, 'globalRank' | 'globalPercentile'> | null> => {
  try {
    const response = await proxyGetJson<StatboticsTeamResponse>(
      'statbotics',
      `/team_event/${teamNumber}/${eventKey}`
    );

    if (!response?.rank?.rank || response.rank.percentile === undefined) {
      console.warn(
        `No event ranking data for team ${teamNumber} at event ${eventKey}`
      );
      return null;
    }

    return {
      eventRank: response.rank.rank,
      eventPercentile: response.rank.percentile,
    };
  } catch (error) {
    console.warn(
      `[Statbotics] Failed to fetch event ranking for team ${teamNumber} at ${eventKey}:`,
      error
    );
    return null;
  }
};

/**
 * Fetch rankings for multiple teams at an event (batch operation)
 * Returns map of teamNumber -> ranking data
 */
export const fetchEventTeamRankings = async (
  eventKey: string,
  teamNumbers: number[]
): Promise<Map<number, Omit<StatboticsRanking, 'globalRank' | 'globalPercentile'>>> => {
  const results = new Map<number, Omit<StatboticsRanking, 'globalRank' | 'globalPercentile'>>();

  // Fetch in parallel with concurrency limit to avoid overwhelming API
  const CONCURRENCY = 5;
  for (let i = 0; i < teamNumbers.length; i += CONCURRENCY) {
    const batch = teamNumbers.slice(i, i + CONCURRENCY);
    const promises = batch.map(teamNumber =>
      fetchTeamEventRanking(teamNumber, eventKey)
        .then(ranking => {
          if (ranking) {
            results.set(teamNumber, ranking);
          }
        })
        .catch(() => {
          // Error already logged in fetchTeamEventRanking
        })
    );

    await Promise.all(promises);
  }

  return results;
};

/**
 * Fetch global rankings for multiple teams (batch operation)
 * Returns map of teamNumber -> global ranking data
 */
export const fetchTeamGlobalRankings = async (
  teamNumbers: number[],
  year: number = 2026
): Promise<Map<number, StatboticsRanking>> => {
  const results = new Map<number, StatboticsRanking>();

  // Fetch in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < teamNumbers.length; i += CONCURRENCY) {
    const batch = teamNumbers.slice(i, i + CONCURRENCY);
    const promises = batch.map(teamNumber =>
      fetchTeamGlobalRanking(teamNumber, year)
        .then(ranking => {
          if (ranking) {
            results.set(teamNumber, ranking);
          }
        })
        .catch(() => {
          // Error already logged in fetchTeamGlobalRanking
        })
    );

    await Promise.all(promises);
  }

  return results;
};

/**
 * Local storage utilities for caching Statbotics ranking data
 * (Temporary cache before consolidation into TeamDB)
 */
const STATBOTICS_RANKING_CACHE_PREFIX = 'statbotics_team_rank_';
const STATBOTICS_RANKING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const cacheTeamRanking = (
  teamNumber: number,
  ranking: StatboticsRanking,
  eventKey?: string
): void => {
  const key = eventKey
    ? `${STATBOTICS_RANKING_CACHE_PREFIX}${teamNumber}_${eventKey}`
    : `${STATBOTICS_RANKING_CACHE_PREFIX}${teamNumber}`;

  const cacheData = {
    ranking,
    cachedAt: Date.now(),
    expiresAt: Date.now() + STATBOTICS_RANKING_CACHE_TTL,
  };

  try {
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn(`Failed to cache ranking for team ${teamNumber}:`, error);
  }
};

export const getCachedTeamRanking = (
  teamNumber: number,
  eventKey?: string
): StatboticsRanking | null => {
  const key = eventKey
    ? `${STATBOTICS_RANKING_CACHE_PREFIX}${teamNumber}_${eventKey}`
    : `${STATBOTICS_RANKING_CACHE_PREFIX}${teamNumber}`;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data = JSON.parse(cached);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return data.ranking;
  } catch (error) {
    console.warn(`Failed to retrieve cached ranking for team ${teamNumber}:`, error);
    return null;
  }
};

export const clearTeamRankingCache = (teamNumber?: number): void => {
  try {
    if (teamNumber) {
      // Clear specific team's cache
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${STATBOTICS_RANKING_CACHE_PREFIX}${teamNumber}`)) {
          localStorage.removeItem(key);
        }
      }
    } else {
      // Clear all ranking cache
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STATBOTICS_RANKING_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('Failed to clear team ranking cache:', error);
  }
};
