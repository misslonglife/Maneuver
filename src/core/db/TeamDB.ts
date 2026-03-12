/**
 * Team Database - Dexie database for team metadata
 * 
 * SINGLE SOURCE OF TRUTH for team metadata from TBA and Statbotics.
 * Stores consolidated TeamProfile objects with indexing for fast queries.
 * 
 * Architecture:
 * - Single table: teamProfiles (indexed by teamNumber)
 * - Compound index: [eventKey+teamNumber] for event-based lookups
 */

import Dexie, { type Table } from 'dexie';
import type { TeamProfile } from '../types/team-profile';

/**
 * TeamDB - Dexie database for team metadata
 * 
 * Provides persistent, indexed storage of team information consolidated
 * from TBA (basic info) and Statbotics (rankings) with competition history.
 */
export class TeamDB extends Dexie {
  teamProfiles!: Table<TeamProfile, number>; // Keyed by teamNumber

  constructor() {
    super('TeamDB');

    this.version(1).stores({
      // Index strategy:
      // - teamNumber: primary key, enables by-team lookups
      // - competitionHistory entries don't have eventKey at root level,
      //   so queries by event should filter in-memory after bulk load
      teamProfiles: '++teamNumber', // Primary key: team number
    });
  }
}

// ============================================================================
// DATABASE INSTANCE
// ============================================================================

export const teamDB = new TeamDB();

// Open database and log any errors
teamDB.open().catch(error => {
  console.error('Failed to open TeamDB:', error);
});
