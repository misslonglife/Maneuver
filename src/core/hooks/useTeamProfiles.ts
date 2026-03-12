/**
 * useTeamProfiles Hook
 * 
 * React hook for consuming team profile data from TeamDB.
 * Provides loading state, error handling, and manual refresh capability.
 * 
 * Usage:
 * const { profiles, isLoading, error, refresh } = useTeamProfiles('2026mrcmp');
 * 
 * // Manually trigger refresh:
 * await refresh();
 */

import { useEffect, useState, useCallback } from 'react';
import { loadTeamProfiles, loadTeamsByEvent, loadAllTeamProfiles } from '@/core/db/teamUtils';
import { refreshTeamDataForEvent, type RefreshTeamDataOptions } from '@/core/db/teamDataManager';
import type { TeamProfile } from '@/core/types/team-profile';

export interface UseTeamProfilesOptions {
  eventKey?: string;        // Filter by specific event
  teamNumbers?: number[];   // Specific teams to load
  autoRefresh?: boolean;    // Auto-refresh on mount (default: false)
  includeRankings?: boolean; // Include Statbotics rankings (default: true)
  includeHistory?: boolean;  // Include competition history (default: true)
}

export interface UseTeamProfilesResult {
  profiles: TeamProfile[];
  isLoading: boolean;
  error: Error | null;
  refresh: (options?: RefreshTeamDataOptions) => Promise<void>;
  stats: {
    totalTeams: number;
    teamsWithRankings: number;
    teamsWithHistory: number;
  };
}

/**
 * React hook for team profiles
 * 
 * Loads team data from TeamDB and provides refresh capability.
 * 
 * @param options - Loading/filtering options
 * @returns Team profiles, loading state, error, and refresh function
 */
export const useTeamProfiles = (options: UseTeamProfilesOptions = {}): UseTeamProfilesResult => {
  const {
    eventKey,
    teamNumbers,
    autoRefresh = false,
    includeRankings = true,
    includeHistory = true,
  } = options;

  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState({
    totalTeams: 0,
    teamsWithRankings: 0,
    teamsWithHistory: 0,
  });

  // Load profiles from TeamDB
  const loadProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loaded: TeamProfile[] = [];

      if (teamNumbers && teamNumbers.length > 0) {
        // Load specific teams
        loaded = await loadTeamProfiles(teamNumbers);
      } else if (eventKey) {
        // Load teams for event
        loaded = await loadTeamsByEvent(eventKey);
      } else {
        // Load all teams
        loaded = await loadAllTeamProfiles();
      }

      setProfiles(loaded);

      // Compute stats
      const withRankings = loaded.filter(t => t.statbotics).length;
      const withHistory = loaded.filter(t => t.competitionHistory.length > 0).length;
      setStats({
        totalTeams: loaded.length,
        teamsWithRankings: withRankings,
        teamsWithHistory: withHistory,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useTeamProfiles] Failed to load profiles:', error);
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventKey, teamNumbers]);

  // Refresh profiles from API and save to TeamDB
  const refresh = useCallback(
    async (refreshOptions: RefreshTeamDataOptions = {}) => {
      if (!eventKey) {
        console.warn('[useTeamProfiles] Cannot refresh without eventKey');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get TBA API key from localStorage if available
        const apiKey = localStorage.getItem('tbaApiKey') || '';

        // Refresh from API
        const refreshedProfiles = await refreshTeamDataForEvent(
          eventKey,
          apiKey,
          {
            includeRankings: refreshOptions.includeRankings ?? includeRankings,
            includeHistory: refreshOptions.includeHistory ?? includeHistory,
          }
        );

        setProfiles(refreshedProfiles);

        // Update stats
        const withRankings = refreshedProfiles.filter(t => t.statbotics).length;
        const withHistory = refreshedProfiles.filter(t => t.competitionHistory.length > 0).length;
        setStats({
          totalTeams: refreshedProfiles.length,
          teamsWithRankings: withRankings,
          teamsWithHistory: withHistory,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useTeamProfiles] Failed to refresh profiles:', error);
        
        // Still try to load from cache on error
        await loadProfiles();
      } finally {
        setIsLoading(false);
      }
    },
    [eventKey, includeRankings, includeHistory, loadProfiles]
  );

  // Initial load on mount or when options change
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Auto-refresh if requested
  useEffect(() => {
    if (autoRefresh && eventKey) {
      refresh();
    }
  }, [autoRefresh, eventKey, refresh]);

  return {
    profiles,
    isLoading,
    error,
    refresh,
    stats,
  };
};

/**
 * Hook variant: Load single team profile
 */
export const useTeamProfile = (teamNumber: number) => {
  const { profiles, isLoading, error, refresh } = useTeamProfiles({
    teamNumbers: [teamNumber],
  });

  return {
    profile: profiles[0] || null,
    isLoading,
    error,
    refresh,
  };
};

/**
 * Hook variant: Load teams for current event
 */
export const useTeamsForEvent = (eventKey: string) => {
  return useTeamProfiles({
    eventKey,
  });
};
