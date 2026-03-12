# Team Database API Reference

**Complete API documentation for all team database functions**

---

## Table of Contents

1. [React Hooks](#react-hooks)
2. [CRUD Operations](#crud-operations)
3. [Data Consolidation](#data-consolidation)
4. [API Utilities](#api-utilities)
5. [Type Definitions](#type-definitions)

---

## React Hooks

### `useTeamProfiles(options)`

**Load multiple team profiles with filtering and refresh capability.**

```typescript
import { useTeamProfiles } from '@/hooks';

const {
  profiles,
  isLoading,
  error,
  refresh,
  stats,
} = useTeamProfiles({
  eventKey?: string;
  teamNumbers?: number[];
  autoRefresh?: boolean;
  includeRankings?: boolean;
  includeHistory?: boolean;
});
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `eventKey` | `string?` | — | Filter by specific event (e.g., "2026mrcmp") |
| `teamNumbers` | `number[]?` | — | Load specific teams by number |
| `autoRefresh` | `boolean?` | `false` | Trigger refresh on mount |
| `includeRankings` | `boolean?` | `true` | Fetch Statbotics rankings |
| `includeHistory` | `boolean?` | `true` | Compute competition history |

**Returns:**

```typescript
{
  profiles: TeamProfile[];           // Loaded teams
  isLoading: boolean;                // Currently fetching data
  error: Error | null;               // Last error (null if success)
  refresh: () => Promise<void>;      // Manual refresh function
  stats: {
    totalTeams: number;              // Total teams loaded
    teamsWithRankings: number;       // Teams with Statbotics data
    teamsWithHistory: number;        // Teams with competition records
  };
}
```

**Examples:**

```typescript
// Load all teams for event
const { profiles } = useTeamProfiles({ eventKey: '2026mrcmp' });

// Load specific teams
const { profiles } = useTeamProfiles({ teamNumbers: [3314, 254, 1690] });

// Load with auto-refresh on mount
const { profiles, refresh } = useTeamProfiles({
  eventKey: '2026mrcmp',
  autoRefresh: true,
});

// Load without rankings (faster)
const { profiles } = useTeamProfiles({
  eventKey: '2026mrcmp',
  includeRankings: false,
});
```

---

### `useTeamProfile(teamNumber)`

**Load single team profile.**

```typescript
import { useTeamProfile } from '@/hooks';

const {
  profile,
  isLoading,
  error,
  refresh,
} = useTeamProfile(3314);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumber` | `number` | Team to load (e.g., 3314) |

**Returns:**

```typescript
{
  profile: TeamProfile | null;       // Loaded team or null
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

**Example:**

```typescript
const { profile } = useTeamProfile(3314);
if (profile) {
  console.log(`${profile.name} ranked #${profile.statbotics?.globalRank}`);
}
```

---

### `useTeamsForEvent(eventKey)`

**Load teams that participated in a specific event.**

```typescript
import { useTeamsForEvent } from '@/hooks';

const { profiles, isLoading, error, refresh } = useTeamsForEvent('2026mrcmp');
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventKey` | `string` | TBA event key (e.g., "2026mrcmp") |

**Returns:** Same as `useTeamProfiles()`

**Example:**

```typescript
const { profiles } = useTeamsForEvent('2026sand');
const topRanked = profiles
  .filter(t => t.statbotics?.globalRank && t.statbotics.globalRank <= 20)
  .sort((a, b) => 
    (a.statbotics?.globalRank ?? 999) - (b.statbotics?.globalRank ?? 999)
  );
```

---

## CRUD Operations

**Location:** `src/core/db/teamUtils.ts`

### `saveTeamProfile(team)`

**Save a single team profile to database.**

```typescript
import { saveTeamProfile } from '@/core/db/teamUtils';

await saveTeamProfile({
  teamNumber: 3314,
  name: 'Team 3314 Exploding Bacon',
  country: 'USA',
  state: 'Michigan',
  competitionHistory: [],
  createdAt: Date.now(),
  lastUpdatedAt: Date.now(),
  dataSource: 'merged',
});
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `team` | `TeamProfile` | Complete team profile object |

**Returns:** `Promise<void>`

**Throws:** Error if save fails

---

### `saveTeamProfiles(teams)`

**Save multiple team profiles (bulk operation).**

```typescript
import { saveTeamProfiles } from '@/core/db/teamUtils';

await saveTeamProfiles([team1, team2, team3]);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teams` | `TeamProfile[]` | Array of team profiles |

**Returns:** `Promise<void>`

---

### `loadTeamProfile(teamNumber)`

**Load single team by number.**

```typescript
import { loadTeamProfile } from '@/core/db/teamUtils';

const team = await loadTeamProfile(3314);
if (team) {
  console.log(team.name);
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumber` | `number` | Team number to load |

**Returns:** `Promise<TeamProfile | undefined>`

---

### `loadAllTeamProfiles()`

**Load all teams from database.**

```typescript
import { loadAllTeamProfiles } from '@/core/db/teamUtils';

const allTeams = await loadAllTeamProfiles();
console.log(`Loaded ${allTeams.length} teams`);
```

**Returns:** `Promise<TeamProfile[]>`

---

### `loadTeamsByEvent(eventKey)`

**Load teams that participated in an event.**

```typescript
import { loadTeamsByEvent } from '@/core/db/teamUtils';

const teams = await loadTeamsByEvent('2026mrcmp');
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventKey` | `string` | Event key to filter by |

**Returns:** `Promise<TeamProfile[]>`

---

### `loadTeamProfiles(teamNumbers)`

**Load specific teams by number.**

```typescript
import { loadTeamProfiles } from '@/core/db/teamUtils';

const teams = await loadTeamProfiles([3314, 254, 1690]);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumbers` | `number[]` | Array of team numbers |

**Returns:** `Promise<TeamProfile[]>`

---

### `updateTeamRanking(teamNumber, globalRank, globalPercentile, eventRank?, eventPercentile?)`

**Update Statbotics ranking for a team.**

```typescript
import { updateTeamRanking } from '@/core/db/teamUtils';

await updateTeamRanking(3314, 15, 45.5, 5, 72.1);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumber` | `number` | Team to update |
| `globalRank` | `number` | Global rank (1-5000+) |
| `globalPercentile` | `number` | Global percentile (0-100) |
| `eventRank` | `number?` | Event-specific rank |
| `eventPercentile` | `number?` | Event-specific percentile |

**Returns:** `Promise<void>`

**Throws:** Error if team not found

---

### `updateCompetitionHistory(teamNumber, eventKey, record)`

**Add or update competition record for a team at an event.**

```typescript
import { updateCompetitionHistory } from '@/core/db/teamUtils';

await updateCompetitionHistory(3314, '2026mrcmp', {
  wins: 8,
  losses: 2,
  ties: 0,
  winRate: 0.8,
  avgRank: 12.5,
  bestRank: 5,
  statboticsRank: 8,
  statboticsPercentile: 85.2,
});
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumber` | `number` | Team to update |
| `eventKey` | `string` | Event (e.g., "2026mrcmp") |
| `record` | `Omit<CompetitionRecord, 'eventKey'>` | Result to save |

**Returns:** `Promise<void>`

---

### `deleteTeamProfile(teamNumber)`

**Delete a team from database.**

```typescript
import { deleteTeamProfile } from '@/core/db/teamUtils';

await deleteTeamProfile(3314);
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `teamNumber` | `number` | Team to delete |

**Returns:** `Promise<void>`

---

### `clearAllTeamProfiles()`

**Delete all teams from database.**

```typescript
import { clearAllTeamProfiles } from '@/core/db/teamUtils';

await clearAllTeamProfiles();
```

**Returns:** `Promise<void>`

---

### `clearTeamProfilesByEvent(eventKey)`

**Remove an event from all teams' competition history.**

```typescript
import { clearTeamProfilesByEvent } from '@/core/db/teamUtils';

await clearTeamProfilesByEvent('2026mrcmp');
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventKey` | `string` | Event to remove |

**Returns:** `Promise<void>`

---

### `getTeamDBStats()`

**Get database statistics.**

```typescript
import { getTeamDBStats } from '@/core/db/teamUtils';

const stats = await getTeamDBStats();
console.log(`${stats.totalTeams} teams, ${stats.teamsWithRankings} with rankings`);
```

**Returns:**

```typescript
{
  totalTeams: number;            // Total teams in database
  teamsWithRankings: number;     // Teams with Statbotics data
  teamsWithHistory: number;      // Teams with competition records
}
```

---

## Data Consolidation

**Location:** `src/core/db/teamDataManager.ts`

### `refreshTeamDataForEvent(eventKey, apiKey?, options?)`

**Consolidate and refresh team data from all sources.**

```typescript
import { refreshTeamDataForEvent } from '@/core/db/teamDataManager';

const profiles = await refreshTeamDataForEvent('2026mrcmp', apiKey, {
  includeRankings: true,
  includeHistory: true,
});
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `eventKey` | `string` | — | Event to refresh (e.g., "2026mrcmp") |
| `apiKey` | `string?` | `''` | Optional TBA API key override |
| `options.includeRankings` | `boolean?` | `true` | Fetch Statbotics data |
| `options.includeHistory` | `boolean?` | `true` | Build competition history |

**Returns:** `Promise<TeamProfile[]>` — Array of merged profiles

**Process:**
1. Fetches TBA team list for event
2. Fetches Statbotics rankings (parallel, 5 concurrent)
3. Builds competition history from cached TBA matches
4. Merges into TeamProfile objects
5. Saves to TeamDB
6. Returns merged data

**Throws:** Error if TBA fetch fails

**Example:**

```typescript
try {
  const teams = await refreshTeamDataForEvent('2026mrcmp');
  console.log(`Refreshed ${teams.length} teams`);
} catch (error) {
  console.error('Failed to refresh:', error);
}
```

---

### `refreshTeamDataForEvents(eventKeys, apiKey?, options?)`

**Refresh team data for multiple events.**

```typescript
import { refreshTeamDataForEvents } from '@/core/db/teamDataManager';

const results = await refreshTeamDataForEvents(
  ['2026mrcmp', '2026sand', '2026chcmp'],
  apiKey
);

for (const [eventKey, profiles] of results) {
  console.log(`${eventKey}: ${profiles.length} teams`);
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventKeys` | `string[]` | Events to refresh |
| `apiKey` | `string?` | Optional TBA API key |
| `options` | `RefreshTeamDataOptions?` | Same as single-event version |

**Returns:** `Promise<Map<string, TeamProfile[]>>` — Map of event → profiles

---

## API Utilities

### Statbotics API (`src/core/lib/statbotics/teamRankUtils.ts`)

#### `fetchTeamGlobalRanking(teamNumber, year?)`

**Fetch global ranking for a team.**

```typescript
import { fetchTeamGlobalRanking } from '@/core/lib/statbotics/teamRankUtils';

const ranking = await fetchTeamGlobalRanking(3314);
// Returns: { globalRank: 15, globalPercentile: 45.5 }
```

**Returns:** `Promise<StatboticsRanking | null>`

---

#### `fetchTeamEventRanking(teamNumber, eventKey)`

**Fetch event-specific ranking.**

```typescript
import { fetchTeamEventRanking } from '@/core/lib/statbotics/teamRankUtils';

const ranking = await fetchTeamEventRanking(3314, '2026mrcmp');
// Returns: { eventRank: 5, eventPercentile: 85.2 }
```

**Returns:** `Promise<{eventRank: number, eventPercentile: number} | null>`

---

#### `fetchEventTeamRankings(eventKey, teamNumbers)`

**Fetch rankings for multiple teams (batch operation).**

```typescript
import { fetchEventTeamRankings } from '@/core/lib/statbotics/teamRankUtils';

const ranks = await fetchEventTeamRankings('2026mrcmp', [3314, 254, 1690]);
// Returns: Map<number, {eventRank, eventPercentile}>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventKey` | `string` | Event key |
| `teamNumbers` | `number[]` | Teams to fetch |

**Returns:** `Promise<Map<number, {eventRank, eventPercentile}>>`

**Note:** Uses 5 concurrent requests to respect API rate limits

---

### TBA API (`src/core/lib/tba/competitionHistoryUtils.ts`)

#### `computeTeamCompetitionRecord(teamNumber, eventKey, eventName?, matches)`

**Compute win/loss/tie record from matches.**

```typescript
import { computeTeamCompetitionRecord } from '@/core/lib/tba/competitionHistoryUtils';

const record = computeTeamCompetitionRecord(
  3314,
  '2026mrcmp',
  'Michigan Regional',
  matches
);
// Returns: { wins: 8, losses: 2, ties: 0, avgRank: 12.5, ... }
```

**Returns:** `CompetitionRecord`

---

#### `buildCompetitionHistory(teamNumber, eventKeys, matchesByEvent)`

**Build competition history across multiple events.**

```typescript
import { buildCompetitionHistory } from '@/core/lib/tba/competitionHistoryUtils';

const history = buildCompetitionHistory(
  3314,
  [
    { eventKey: '2026mrcmp', eventName: 'Michigan Regional' },
    { eventKey: '2026sand', eventName: 'San Diego Regional' },
  ],
  matchesByEvent // Map<string, TBAMatch[]>
);
```

**Returns:** `CompetitionRecord[]` — Sorted by event key

---

#### `extractTeamsFromTBAMatches(matches)`

**Get all team numbers from matches.**

```typescript
import { extractTeamsFromTBAMatches } from '@/core/lib/tba/competitionHistoryUtils';

const teamSet = extractTeamsFromTBAMatches(matches);
```

**Returns:** `Set<number>`

---

## Type Definitions

### `TeamProfile`

```typescript
interface TeamProfile {
  // Identification
  teamNumber: number;
  name: string;
  nickname?: string;
  country?: string;
  state?: string;
  city?: string;
  schoolName?: string;

  // Rankings
  statbotics?: {
    globalRank: number;
    globalPercentile: number;
    eventRank?: number;
    eventPercentile?: number;
  };
  statboticsLastUpdatedAt?: number;

  // Competition History
  competitionHistory: CompetitionRecord[];
  aggregateWins?: number;
  aggregateLosses?: number;
  aggregateTies?: number;
  avgRankTrend?: number;

  // Metadata
  createdAt: number;
  lastUpdatedAt: number;
  dataSource: 'tba' | 'statbotics' | 'merged';
}
```

---

### `CompetitionRecord`

```typescript
interface CompetitionRecord {
  eventKey: string;           // e.g., "2026mrcmp"
  eventName?: string;
  wins: number;
  losses: number;
  ties: number;
  winRate?: number;
  avgRank?: number;
  bestRank?: number;
  statboticsRank?: number;
  statboticsPercentile?: number;
}
```

---

### `StatboticsRanking`

```typescript
interface StatboticsRanking {
  globalRank: number;
  globalPercentile: number;
  eventRank?: number;
  eventPercentile?: number;
}
```

---

### `UseTeamProfilesOptions`

```typescript
interface UseTeamProfilesOptions {
  eventKey?: string;
  teamNumbers?: number[];
  autoRefresh?: boolean;
  includeRankings?: boolean;
  includeHistory?: boolean;
}
```

---

### `UseTeamProfilesResult`

```typescript
interface UseTeamProfilesResult {
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
```

---

## Error Handling

All functions may throw errors:

```typescript
try {
  const profiles = await refreshTeamDataForEvent('2026mrcmp');
} catch (error) {
  if (error instanceof TypeError) {
    // Network/parsing error
  } else if (error.message.includes('not found')) {
    // Resource not found
  } else {
    // Unknown error
  }
}
```

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `TypeError: fetch failed` | Network issue | Check internet, retry |
| `Event not found` | Invalid event key | Verify event key format |
| `Team not found` | Database entry missing | Run refresh first |
| `Failed to open database` | IndexedDB disabled | Enable IndexedDB in browser |

---

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Load from cache | 1-10ms | Fast! From IndexedDB |
| Refresh (50 teams) | 3-5s | Network dependent |
| Statbotics batch (50) | 1-2s | Rate limited to 5 concurrent |
| Save to database | ~50ms | Bulk put operation |
| Clear all data | ~10ms | Quick wipe |

---

## See Also

- [Team Database Architecture](./TEAM_DATABASE.md)
- [Integration Guide](./TEAM_DATABASE_INTEGRATION.md)
- [Framework Design](./FRAMEWORK_DESIGN.md)

