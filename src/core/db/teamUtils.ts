/**
 * Team Database CRUD Operations
 * 
 * Provides utilities for saving, loading, and managing team profiles.
 * All operations use TeamDB as the single source of truth.
 */

import type { TeamProfile, CompetitionRecord } from '../types/team-profile';
import { teamDB } from './TeamDB';

/**
 * Save a single team profile to database
 */
export const saveTeamProfile = async (
  team: TeamProfile
): Promise<void> => {
  try {
    await teamDB.teamProfiles.put(team);
  } catch (error) {
    console.error(`Failed to save team profile for team ${team.teamNumber}:`, error);
    throw error;
  }
};

/**
 * Save multiple team profiles (bulk operation)
 */
export const saveTeamProfiles = async (teams: TeamProfile[]): Promise<void> => {
  try {
    await teamDB.teamProfiles.bulkPut(teams);
  } catch (error) {
    console.error('Failed to save team profiles:', error);
    throw error;
  }
};

/**
 * Load a single team profile by team number
 */
export const loadTeamProfile = async (
  teamNumber: number
): Promise<TeamProfile | undefined> => {
  try {
    return await teamDB.teamProfiles.get(teamNumber);
  } catch (error) {
    console.error(`Failed to load team profile for team ${teamNumber}:`, error);
    return undefined;
  }
};

/**
 * Load all team profiles
 */
export const loadAllTeamProfiles = async (): Promise<TeamProfile[]> => {
  try {
    return await teamDB.teamProfiles.toArray();
  } catch (error) {
    console.error('Failed to load all team profiles:', error);
    return [];
  }
};

/**
 * Load team profiles for teams that participated in a specific event
 * Filters in-memory since eventKey is nested in competitionHistory
 */
export const loadTeamsByEvent = async (eventKey: string): Promise<TeamProfile[]> => {
  try {
    const allTeams = await teamDB.teamProfiles.toArray();
    return allTeams.filter(team =>
      team.competitionHistory.some(record => record.eventKey === eventKey)
    );
  } catch (error) {
    console.error(`Failed to load teams for event ${eventKey}:`, error);
    return [];
  }
};

/**
 * Load team profiles for multiple teams
 */
export const loadTeamProfiles = async (teamNumbers: number[]): Promise<TeamProfile[]> => {
  try {
    return await teamDB.teamProfiles
      .where('teamNumber')
      .anyOf(teamNumbers)
      .toArray();
  } catch (error) {
    console.error(`Failed to load team profiles for teams ${teamNumbers.join(',')}:`, error);
    return [];
  }
};

/**
 * Update Statbotics ranking for a team (global rank + event-specific if provided)
 */
export const updateTeamRanking = async (
  teamNumber: number,
  globalRank: number,
  globalPercentile: number,
  eventRank?: number,
  eventPercentile?: number
): Promise<void> => {
  try {
    const team = await teamDB.teamProfiles.get(teamNumber);
    if (!team) {
      console.warn(`Team ${teamNumber} not found in database when updating ranking`);
      return;
    }

    team.statbotics = {
      globalRank,
      globalPercentile,
      ...(eventRank !== undefined && { eventRank }),
      ...(eventPercentile !== undefined && { eventPercentile }),
    };
    team.statboticsLastUpdatedAt = Date.now();
    team.lastUpdatedAt = Date.now();

    await teamDB.teamProfiles.put(team);
  } catch (error) {
    console.error(`Failed to update ranking for team ${teamNumber}:`, error);
    throw error;
  }
};

/**
 * Add or update competition history for a team at a specific event
 */
export const updateCompetitionHistory = async (
  teamNumber: number,
  eventKey: string,
  record: Omit<CompetitionRecord, 'eventKey'>
): Promise<void> => {
  try {
    const team = await teamDB.teamProfiles.get(teamNumber);
    if (!team) {
      console.warn(`Team ${teamNumber} not found in database when updating competition history`);
      return;
    }

    // Find and update existing record, or add new one
    const existingIndex = team.competitionHistory.findIndex(r => r.eventKey === eventKey);
    const newRecord: CompetitionRecord = {
      eventKey,
      ...record,
    };

    if (existingIndex >= 0) {
      team.competitionHistory[existingIndex] = newRecord;
    } else {
      team.competitionHistory.push(newRecord);
    }

    // Recompute aggregate stats
    recomputeAggregateStats(team);
    team.lastUpdatedAt = Date.now();

    await teamDB.teamProfiles.put(team);
  } catch (error) {
    console.error(
      `Failed to update competition history for team ${teamNumber} at event ${eventKey}:`,
      error
    );
    throw error;
  }
};

/**
 * Recompute aggregate statistics from competition history
 */
export const recomputeAggregateStats = (team: TeamProfile): void => {
  if (team.competitionHistory.length === 0) {
    team.aggregateWins = 0;
    team.aggregateLosses = 0;
    team.aggregateTies = 0;
    team.avgRankTrend = undefined;
    return;
  }

  team.aggregateWins = team.competitionHistory.reduce((sum, r) => sum + r.wins, 0);
  team.aggregateLosses = team.competitionHistory.reduce((sum, r) => sum + r.losses, 0);
  team.aggregateTies = team.competitionHistory.reduce((sum, r) => sum + r.ties, 0);

  // Compute average of avgRank values (non-undefined only)
  const avgRanks = team.competitionHistory
    .map(r => r.avgRank)
    .filter((rank): rank is number => rank !== undefined);
  team.avgRankTrend = avgRanks.length > 0 ? avgRanks.reduce((a, b) => a + b, 0) / avgRanks.length : undefined;
};

/**
 * Delete a team profile
 */
export const deleteTeamProfile = async (teamNumber: number): Promise<void> => {
  try {
    await teamDB.teamProfiles.delete(teamNumber);
  } catch (error) {
    console.error(`Failed to delete team profile for team ${teamNumber}:`, error);
    throw error;
  }
};

/**
 * Clear all team profiles
 */
export const clearAllTeamProfiles = async (): Promise<void> => {
  try {
    await teamDB.teamProfiles.clear();
  } catch (error) {
    console.error('Failed to clear team profiles:', error);
    throw error;
  }
};

/**
 * Clear team profiles for a specific event
 */
export const clearTeamProfilesByEvent = async (eventKey: string): Promise<void> => {
  try {
    const teams = await loadTeamsByEvent(eventKey);
    
    // Remove the event from each team's competition history
    for (const team of teams) {
      team.competitionHistory = team.competitionHistory.filter(r => r.eventKey !== eventKey);
      recomputeAggregateStats(team);
      team.lastUpdatedAt = Date.now();
      await teamDB.teamProfiles.put(team);
    }
  } catch (error) {
    console.error(`Failed to clear team profiles for event ${eventKey}:`, error);
    throw error;
  }
};

/**
 * Get database statistics
 */
export const getTeamDBStats = async (): Promise<{
  totalTeams: number;
  teamsWithRankings: number;
  teamsWithHistory: number;
}> => {
  try {
    const teams = await teamDB.teamProfiles.toArray();
    return {
      totalTeams: teams.length,
      teamsWithRankings: teams.filter(t => t.statbotics).length,
      teamsWithHistory: teams.filter(t => t.competitionHistory.length > 0).length,
    };
  } catch (error) {
    console.error('Failed to get team database stats:', error);
    return {
      totalTeams: 0,
      teamsWithRankings: 0,
      teamsWithHistory: 0,
    };
  }
};
