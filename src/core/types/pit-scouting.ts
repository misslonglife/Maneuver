/**
 * Pit Scouting Entry Types
 * 
 * SINGLE SOURCE OF TRUTH: This file defines the base pit scouting entry type.
 * 
 * STABLE: These types are year-agnostic and should not need modification.
 * Game-specific data is stored in the `gameData` field.
 */


/**
 * Base interface for pit scouting entries
 * 
 * DESIGN PRINCIPLES:
 * - Framework defines universal fields (photo, weight, drivetrain, language, notes)
 * - Game-specific data stored in `gameData` object (same pattern as ScoutingEntryBase)
 * - ID format: "pit-{teamNumber}-{eventKey}-{timestamp}-{random}" for natural collision detection
 * 
 * EXTENSION EXAMPLE (maneuver-2025):
 * interface PitScoutingEntry2025 extends PitScoutingEntryBase {
 *   gameData: {
 *     groundPickupCapabilities?: {
 *       coralGround: boolean;
 *       algaeGround: boolean;
 *     };
 *     reportedAutoScoring?: {
 *       canScoreL1: boolean;
 *       canScoreL2: boolean;
 *       // etc.
 *     };
 *     reportedTeleopScoring?: object;
 *     reportedEndgame?: object;
 *   };
 * }
 */
export interface PitScoutingEntryBase {
    id: string;                    // "pit-{teamNumber}-{eventKey}-{timestamp}-{random}"
    teamNumber: number;             // Team number (matches ScoutingEntryBase): 3314
    eventKey: string;               // TBA event key: "2025mrcmp"
    scoutName: string;              // Scout who recorded this entry
    timestamp: number;              // Unix milliseconds (not ISO string) for efficient comparison

    // Universal pit scouting fields (not game-specific)
    robotPhoto?: string;            // Base64 or URL

    notes?: string;                 // General observations

    // Game-specific data (defined by game implementation)
    gameData: Record<string, unknown>; // Game implementations define typed structure here (required, use {} for empty)
}

/**
 * Pit scouting data collection wrapper
 */
export interface PitScoutingData {
    entries: PitScoutingEntryBase[];
    lastUpdated: number;
}

/**
 * Pit scouting statistics
 */
export interface PitScoutingStats {
    totalEntries: number;
    teams: number[];
    events: string[];
    scouts: string[];
}
