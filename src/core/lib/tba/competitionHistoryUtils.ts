/**
 * Competition History Utilities
 * 
 * Extracts competition results (wins/losses/ties/rankings) from TBA match data.
 * Builds CompetitionRecord objects from raw TBA match results.
 */

import type { TBAMatch } from '@/core/lib/tba/tbaUtils';
import type { TBAMatchData } from '@/core/lib/tbaMatchData';
import type { CompetitionRecord } from '@/core/types/team-profile';

/**
 * Extract match results for a specific team from raw TBA match data
 * Returns wins, losses, ties, and best ranking
 */
export const computeTeamCompetitionRecord = (
  teamNumber: number,
  eventKey: string,
  eventName: string | undefined,
  matches: (TBAMatch | TBAMatchData)[]
): CompetitionRecord => {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let rankings: number[] = [];

  // Filter matches for this event only
  const eventMatches = matches.filter(
    match => (match as any).event_key === eventKey || (match as any).eventKey === eventKey
  );

  // Count wins/losses/ties
  for (const match of eventMatches) {
    const tbaMatch = match as TBAMatch;
    const teamKey = `frc${teamNumber}`;

    // Determine which alliance the team was on
    let teamAlliance: 'red' | 'blue' | null = null;
    if (tbaMatch.alliances?.red?.team_keys?.includes(teamKey)) {
      teamAlliance = 'red';
    } else if (tbaMatch.alliances?.blue?.team_keys?.includes(teamKey)) {
      teamAlliance = 'blue';
    }

    if (!teamAlliance) continue;

    // Determine match result
    const winningAlliance = tbaMatch.winning_alliance as 'red' | 'blue' | '';

    if (winningAlliance === teamAlliance) {
      wins++;
    } else if (winningAlliance === '') {
      // Tie (both scores equal)
      ties++;
    } else {
      losses++;
    }
  }

  // Try to extract ranking from match metadata if available
  // Note: TBA doesn't provide explicit ranking per match in standard API
  // This would need to be computed from playoff bracket or sourced elsewhere
  const totalMatches = wins + losses + ties;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const avgRank = totalMatches > 0 ? rankings.length > 0 
    ? rankings.reduce((a, b) => a + b, 0) / rankings.length 
    : undefined 
    : undefined;

  return {
    eventKey,
    eventName,
    wins,
    losses,
    ties,
    winRate,
    avgRank,
    bestRank: rankings.length > 0 ? Math.min(...rankings) : undefined,
  };
};

/**
 * Extract competition history for a team across multiple events
 */
export const buildCompetitionHistory = (
  teamNumber: number,
  eventKeys: { eventKey: string; eventName?: string }[],
  matchesByEvent: Map<string, (TBAMatch | TBAMatchData)[]>
): CompetitionRecord[] => {
  const history: CompetitionRecord[] = [];

  for (const event of eventKeys) {
    const matches = matchesByEvent.get(event.eventKey) || [];
    if (matches.length === 0) {
      continue; // Skip events with no match data
    }

    const record = computeTeamCompetitionRecord(
      teamNumber,
      event.eventKey,
      event.eventName,
      matches
    );

    if (record.wins + record.losses + record.ties > 0) {
      history.push(record);
    }
  }

  return history;
};

/**
 * Parse TBA team key to extract team number
 * @param teamKey TBA team key format: "frc1234"
 * @returns Team number (1234) or null if invalid
 */
export const parseTeamFromKey = (teamKey: string): number | null => {
  const match = teamKey.match(/^frc(\d+)$/i);
  if (!match || !match[1]) return null;

  const teamNumber = parseInt(match[1], 10);
  return Number.isFinite(teamNumber) ? teamNumber : null;
};

/**
 * Extract all team numbers from a list of TBA matches
 */
export const extractTeamsFromTBAMatches = (matches: (TBAMatch | TBAMatchData)[]): Set<number> => {
  const teams = new Set<number>();

  for (const match of matches) {
    const tbaMatch = match as TBAMatch;
    const redTeams = tbaMatch.alliances?.red?.team_keys || [];
    const blueTeams = tbaMatch.alliances?.blue?.team_keys || [];

    for (const teamKey of [...redTeams, ...blueTeams]) {
      const teamNumber = parseTeamFromKey(teamKey);
      if (teamNumber) {
        teams.add(teamNumber);
      }
    }
  }

  return teams;
};

/**
 * Group matches by event key
 */
export const groupMatchesByEvent = (
  matches: (TBAMatch | TBAMatchData)[]
): Map<string, (TBAMatch | TBAMatchData)[]> => {
  const grouped = new Map<string, (TBAMatch | TBAMatchData)[]>();

  for (const match of matches) {
    const eventKey = (match as any).event_key || (match as any).eventKey;
    if (!eventKey) continue;

    if (!grouped.has(eventKey)) {
      grouped.set(eventKey, []);
    }
    grouped.get(eventKey)!.push(match);
  }

  return grouped;
};

/**
 * Sort competition records by event (chronological for 2026 season)
 */
export const sortCompetitionHistory = (history: CompetitionRecord[]): CompetitionRecord[] => {
  // Sort by eventKey (assumes TBA event keys sort chronologically)
  return [...history].sort((a, b) => (a.eventKey || '').localeCompare(b.eventKey || ''));
};
