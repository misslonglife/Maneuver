/**
 * Team Data Manager
 * 
 * SINGLE SOURCE OF TRUTH orchestration layer.
 * 
 * Consolidates data from multiple sources:
 * - TBA: Basic team info + match results
 * - Statbotics: Team rankings (global + event-specific)
 * 
 * Provides single refresh function that:
 * 1. Fetches all necessary data
 * 2. Merges into unified TeamProfile objects
 * 3. Saves to TeamDB once
 * 4. Returns consolidated data
 */

import { getEventTeams } from '@/core/lib/tba/tbaUtils';
import {
  fetchTeamGlobalRankings,
  fetchEventTeamRankings,
  clearTeamRankingCache,
} from '@/core/lib/statbotics/teamRankUtils';
import {
  buildCompetitionHistory,
} from '@/core/lib/tba/competitionHistoryUtils';
import { saveTeamProfiles, recomputeAggregateStats } from '@/core/db/teamUtils';
import { getCachedTBAEventMatches, getCachedTBAEventKeys } from '@/core/lib/tbaCache';
import type { TeamProfile } from '@/core/types/team-profile';

export interface RefreshTeamDataOptions {
  includeRankings?: boolean; // Fetch Statbotics rankings (default: true)
  includeHistory?: boolean;  // Compute competition history (default: true)
}

/**
 * Refresh team data for an event
 * 
 * SINGLE SOURCE OF TRUTH function. Call this to:
 * 1. Fetch TBA team info for the event
 * 2. Optionally fetch Statbotics rankings
 * 3. Optionally compute competition history from cached TBA matches
 * 4. Save consolidated TeamProfile objects to TeamDB
 * 5. Return the merged data
 * 
 * @param eventKey - TBA event key (e.g., "2026mrcmp")
 * @param apiKey - Optional TBA API key to use
 * @param options - Refresh options
 * @returns Array of TeamProfile objects
 */
export const refreshTeamDataForEvent = async (
  eventKey: string,
  apiKey: string = '',
  options: RefreshTeamDataOptions = {}
): Promise<TeamProfile[]> => {
  const {
    includeRankings = true,
    includeHistory = true,
  } = options;

  const profiles: TeamProfile[] = [];

  try {
    console.log(`[TeamDataManager] Refreshing team data for event ${eventKey}`);

    // Step 1: Fetch TBA team data for this event
    console.log(`[TeamDataManager] Fetching TBA teams for ${eventKey}...`);
    const tbaTeams = await getEventTeams(eventKey, apiKey);

    if (!tbaTeams || tbaTeams.length === 0) {
      console.warn(`[TeamDataManager] No teams found for event ${eventKey}`);
      return [];
    }

    const teamNumbers = tbaTeams.map(t => t.team_number);
    console.log(`[TeamDataManager] Found ${teamNumbers.length} teams for ${eventKey}`);

    // Step 2: Optionally fetch Statbotics rankings
    let globalRankings = new Map<number, any>();
    let eventRankings = new Map<number, any>();

    if (includeRankings) {
      console.log(`[TeamDataManager] Fetching Statbotics rankings...`);
      try {
        globalRankings = await fetchTeamGlobalRankings(teamNumbers);
        eventRankings = await fetchEventTeamRankings(eventKey, teamNumbers);
        console.log(
          `[TeamDataManager] Retrieved ${globalRankings.size} global and ${eventRankings.size} event rankings`
        );
      } catch (error) {
        console.warn('[TeamDataManager] Failed to fetch Statbotics rankings:', error);
        // Don't fail entirely, continue with available data
      }
    }

    // Step 3: Optionally compute competition history
    let historyByTeam = new Map<number, any[]>();

    if (includeHistory) {
      console.log(`[TeamDataManager] Building competition history...`);
      try {
        // Get all cached TBA matches for all events we have data for
        const eventKeys = await getCachedTBAEventKeys();
        const matchesByEvent = new Map<string, any[]>();

        for (const eventKey of eventKeys) {
          const matches = await getCachedTBAEventMatches(eventKey);
          if (matches && matches.length > 0) {
            matchesByEvent.set(eventKey, matches);
          }
        }

        // For each team, compute their history across all events
        for (const teamNumber of teamNumbers) {
          const history = buildCompetitionHistory(
            teamNumber,
            eventKeys.map(key => ({
              eventKey: key,
              eventName: undefined, // Would need event details to populate
            })),
            matchesByEvent as any
          );

          if (history.length > 0) {
            historyByTeam.set(teamNumber, history);
          }
        }

        console.log(
          `[TeamDataManager] Computed history for ${historyByTeam.size} teams`
        );
      } catch (error) {
        console.warn('[TeamDataManager] Failed to build competition history:', error);
        // Don't fail entirely, continue without history
      }
    }

    // Step 4: Merge into unified TeamProfile objects
    console.log(`[TeamDataManager] Merging data into TeamProfile objects...`);
    for (const tbaTeam of tbaTeams) {
      const profile: TeamProfile = {
        teamNumber: tbaTeam.team_number,
        name: tbaTeam.name || tbaTeam.nickname || `Team ${tbaTeam.team_number}`,
        nickname: tbaTeam.nickname,
        country: tbaTeam.country,
        state: tbaTeam.state_prov,
        city: tbaTeam.city,
        schoolName: tbaTeam.school_name,

        // Add Statbotics ranking if available
        statbotics: globalRankings.get(tbaTeam.team_number),
        statboticsLastUpdatedAt: includeRankings ? Date.now() : undefined,

        // Add competition history
        competitionHistory: historyByTeam.get(tbaTeam.team_number) || [],

        // Metadata
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        dataSource: 'merged',
      };

      // Recompute aggregate stats
      recomputeAggregateStats(profile);

      profiles.push(profile);
    }

    // Step 5: Save to TeamDB
    console.log(`[TeamDataManager] Saving ${profiles.length} team profiles to TeamDB...`);
    await saveTeamProfiles(profiles);

    // Clean up temporary Statbotics ranking cache
    if (includeRankings) {
      clearTeamRankingCache();
    }

    console.log(`[TeamDataManager] ✓ Refresh complete for ${eventKey}`);
    return profiles;
  } catch (error) {
    console.error(`[TeamDataManager] Fatal error during refresh:`, error);
    throw error;
  }
};

/**
 * Refresh team data for multiple events
 */
export const refreshTeamDataForEvents = async (
  eventKeys: string[],
  apiKey: string = '',
  options: RefreshTeamDataOptions = {}
): Promise<Map<string, TeamProfile[]>> => {
  const results = new Map<string, TeamProfile[]>();

  for (const eventKey of eventKeys) {
    try {
      const profiles = await refreshTeamDataForEvent(eventKey, apiKey, options);
      results.set(eventKey, profiles);
    } catch (error) {
      console.error(`[TeamDataManager] Failed to refresh ${eventKey}:`, error);
      results.set(eventKey, []);
    }
  }

  return results;
};
