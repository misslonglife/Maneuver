# Team Database Architecture

**Single Source of Truth for Team Metadata**

## Overview

The Team Database system consolidates team information from multiple external sources (TBA, Statbotics, match results) into a unified, persistent database stored in IndexedDB via Dexie. This provides a **single source of truth** for all team metadata, eliminating scattered localStorage caches and ensuring data consistency across the application.

---

## Design Principles

### 1. **Single Source of Truth**

All team metadata flows through one persistent database (`TeamDB`):
- No duplicate team data in localStorage
- No hardcoded team information
- One refresh point consolidates all external data

```
TBA API       Statbotics API      TBA Matches
    ↓              ↓                  ↓
    └──→ teamDataManager.refreshTeamDataForEvent() ←──┘
           (consolidates & validates)
           ↓
        TeamDB (single table: teamProfiles)
           ↓
    useTeamProfiles() hook ← UI components
```

### 2. **Offline-First**

- Data persists in IndexedDB when online
- UI uses cached data if network fails
- No forced network dependency for reading team data
- Graceful degradation with stale data available

### 3. **Year-Agnostic (Framework-Level)**

- All code in `src/core/` is reusable across game years
- `TeamProfile` type has no game-specific fields
- Game implementations define custom extensions if needed

### 4. **Performance-Optimized**

- Index on `teamNumber` for O(1) lookups
- Batch fetching with concurrency control (5 simultaneous requests)
- Lazy-load competition history only on demand
- Memoized results in React hooks

---

## Data Model

### `TeamProfile` (Complete Team Metadata)

```typescript
interface TeamProfile {
  // ========== FROM TBA ==========
  teamNumber: number;              // Primary key
  name: string;                    // e.g., "Team 3314 Exploding Bacon"
  nickname?: string;
  country?: string;
  state?: string;
  city?: string;
  schoolName?: string;

  // ========== FROM STATBOTICS ==========
  statbotics?: {
    globalRank: number;            // Rank across all teams
    globalPercentile: number;      // 0-100
    eventRank?: number;            // Rank at specific event
    eventPercentile?: number;
  };
  statboticsLastUpdatedAt?: number;

  // ========== FROM TBA MATCHES ==========
  competitionHistory: CompetitionRecord[];  // Per-event results
  aggregateWins?: number;                   // Sum across all events
  aggregateLosses?: number;
  aggregateTies?: number;
  avgRankTrend?: number;                    // Indicator of improvement/decline

  // ========== METADATA ==========
  createdAt: number;               // When profile was created
  lastUpdatedAt: number;           // When profile was last refreshed
  dataSource: 'tba' | 'statbotics' | 'merged';
}

interface CompetitionRecord {
  eventKey: string;                // e.g., "2026mrcmp"
  eventName?: string;
  wins: number;
  losses: number;
  ties: number;
  winRate?: number;                // Computed: wins / (wins + losses + ties)
  avgRank?: number;                // Average finish ranking
  bestRank?: number;               // Best (lowest) finish ranking
  statboticsRank?: number;         // Rank at this event (from Statbotics)
  statboticsPercentile?: number;
}
```

---

## Database Schema

### TeamDB (IndexedDB)

| Table | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `teamProfiles` | `teamNumber` | `teamNumber` | Store consolidated team metadata |

**Storage:** IndexedDB (persistent, no size limit, available offline)
**Scope:** 1 entry per team per season
**Typical size:** ~2-5 KB per team profile

---

## Architecture Layers

### 1. **Data Types** (`src/core/types/team-profile.ts`)

Defines `TeamProfile`, `CompetitionRecord`, `StatboticsRanking` types.

```typescript
import { TeamProfile, CompetitionRecord } from '@/core/types';
```

### 2. **Database Layer** (`src/core/db/TeamDB.ts`)

Dexie database class with single `teamProfiles` table.

```typescript
import { teamDB } from '@/core/db/TeamDB';
const profile = await teamDB.teamProfiles.get(3314);
```

### 3. **CRUD Operations** (`src/core/db/teamUtils.ts`)

Low-level database operations:
- `saveTeamProfile(team)` — Save single team
- `loadTeamProfile(teamNumber)` — Load by team number
- `loadTeamsByEvent(eventKey)` — Filter by event
- `updateTeamRanking(teamNumber, rank, percentile)` — Update Statbotics data
- `updateCompetitionHistory(teamNumber, eventKey, record)` — Add/update event results
- `clearAllTeamProfiles()` — Wipe entire database

### 4. **API Integration Utilities**

#### `src/core/lib/statbotics/teamRankUtils.ts`
- `fetchTeamGlobalRanking(teamNumber)` — Fetch global rank from Statbotics
- `fetchEventTeamRankings(eventKey, teamNumbers)` — Batch fetch event ranks
- Includes local caching (temporary, cleared after TeamDB save)

#### `src/core/lib/tba/competitionHistoryUtils.ts`
- `computeTeamCompetitionRecord(teamNumber, eventKey, matches)` — Parse match results
- `buildCompetitionHistory(teamNumber, eventKeys, matches)` — Build full history
- Helper functions for TBA team key parsing

### 5. **Data Consolidation** (`src/core/db/teamDataManager.ts`)

**Orchestration layer** — single refresh function:

```typescript
const profiles = await refreshTeamDataForEvent(
  eventKey,
  apiKey,
  { includeRankings: true, includeHistory: true }
);
```

**Steps:**
1. Fetch TBA team info for event
2. Fetch Statbotics rankings (global + event-specific)
3. Compute competition history from cached TBA matches
4. Merge into unified `TeamProfile` objects
5. Save to TeamDB once
6. Clear temporary caches

### 6. **React Hook** (`src/core/hooks/useTeamProfiles.ts`)

Primary UI integration point:

```typescript
const { profiles, isLoading, error, refresh, stats } = useTeamProfiles({
  eventKey: '2026mrcmp',
  includeRankings: true,
  includeHistory: true,
});

// Manual refresh
await refresh();
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ External APIs                                                   │
├──────────────────────────────────────────┬──────────────────────┤
│ TBA (/event/{key}/teams/keys)            │ Statbotics           │
│ TBA matches (via tbaCache)               │ (/team_event/{t,e})  │
└──────────────────┬───────────────────────┴──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ API Utilities                                                   │
├──────────────────────────────────────────┬──────────────────────┤
│ tbaUtils.ts            (fetch TBA teams) │ teamRankUtils.ts     │
│ competitionHistoryUtils (parse matches)  │ (fetch rankings)     │
└──────────────────┬───────────────────────┴──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ teamDataManager.refreshTeamDataForEvent()                        │
│ (Consolidation: merge TBA + Statbotics + history)               │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ↓
            ┌──────────────┐
            │   TeamDB     │
            │ teamProfiles │  ← SINGLE SOURCE OF TRUTH
            └──────────────┘
                   │
         ┌─────────┴──────────┬──────────────┐
         ↓                    ↓              ↓
    teamUtils.ts      useTeamProfiles()    Direct queries
    (CRUD ops)        (React hook)         (advanced)
         │                    │              │
         └─────────────────────┴──────────────┘
                   │
                   ↓ (cached results)
          ┌────────────────────┐
          │ React Components   │
          │ (Strategy, Stats)  │
          └────────────────────┘
```

---

## Usage Patterns

### Pattern 1: Load Team Data with Hook

**Most common pattern for UI components:**

```typescript
import { useTeamProfiles } from '@/hooks';

function TeamOverviewPage() {
  const { profiles, isLoading, error, refresh } = useTeamProfiles({
    eventKey: '2026mrcmp',
    includeRankings: true,
    includeHistory: true,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorAlert error={error} onRetry={refresh} />;

  return (
    <>
      <button onClick={() => refresh()}>Refresh Rankings</button>
      {profiles.map(team => (
        <TeamCard key={team.teamNumber} team={team} />
      ))}
    </>
  );
}
```

### Pattern 2: Load Single Team

```typescript
import { useTeamProfile } from '@/hooks';

function TeamDetailPage({ teamNumber }) {
  const { profile, isLoading, error } = useTeamProfile(teamNumber);

  if (!profile) return null;

  return (
    <div>
      <h1>{profile.name}</h1>
      <p>Global Rank: #{profile.statbotics?.globalRank}</p>
      <p>Country: {profile.country}</p>
    </div>
  );
}
```

### Pattern 3: Manual Refresh (Admin/Settings)

```typescript
function AdminRefreshPage() {
  const [eventKey, setEventKey] = useState('2026mrcmp');
  const { refresh, isLoading } = useTeamProfiles({ eventKey });

  return (
    <div>
      <input 
        value={eventKey} 
        onChange={e => setEventKey(e.target.value)} 
      />
      <button 
        onClick={() => refresh()} 
        disabled={isLoading}
      >
        {isLoading ? 'Refreshing...' : 'Refresh All Teams'}
      </button>
    </div>
  );
}
```

### Pattern 4: Direct Database Access (Advanced)

```typescript
import { loadTeamsByEvent, updateTeamRanking } from '@/core/db/teamUtils';

// Load teams for an event directly
const teams = await loadTeamsByEvent('2026mrcmp');

// Update ranking for a single team
await updateTeamRanking(3314, 15, 45.5);
```

---

## Test Scenarios

### ✅ Happy Path
1. Load event page
2. Call `useTeamProfiles(eventKey)`
3. Hook loads from TeamDB (instant)
4. User clicks "Refresh"
5. Fetches TBA + Statbotics + history
6. Merges and saves to TeamDB
7. Hook re-renders with new data

### ✅ Offline Mode
1. User is online, data cached
2. Network goes down
3. Component still renders from cached TeamDB data
4. Refresh button disabled (can't reach APIs)
5. User goes back online
6. Refresh works normally

### ✅ Partial Data Failure
1. TBA fetch succeeds
2. Statbotics fetch fails
3. System still saves TBA + cached rankings
4. Continues without rankings (degraded)
5. User sees "Stale rankings" indicator

### ✅ Multi-Event Season
1. Load event A → refreshes
2. Load event B → refreshes (adds to TeamDB)
3. Load event A again → fast (cached in TeamDB)
4. Both events available for year-over-year comparison

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Load from TeamDB (single team) | ~1ms | IndexedDB index lookup |
| Load from TeamDB (all teams) | ~10-50ms | Depends on team count |
| Refresh team data | 3-8s | Network + parsing (depends on count) |
| Statbotics batch (50 teams) | 1-2s | Rate-limited, 5 concurrent |
| Memory (200 teams) | ~2-3MB | Cached in RAM while page open |
| Storage (200 teams) | ~1-2MB | IndexedDB persistent |

---

## Migration Guide

### From: Scattered localStorage Team Caches

**Before (❌ anti-pattern):**
```typescript
localStorage.setItem('tba_teams_' + eventKey, JSON.stringify(teams));
localStorage.setItem('event_teams_' + eventKey, JSON.stringify(teams));
localStorage.setItem('statbotics_ranks_' + eventKey, JSON.stringify(ranks));
```

**After (✅ single source of truth):**
```typescript
const { profiles } = useTeamProfiles({ eventKey });
// All data consolidated in one place
```

### From: Manual Team Fetching

**Before (❌ scattered logic):**
```typescript
const teams = await getEventTeams(eventKey);
const ranks = await fetchTeamRankings(eventKey, teams);
const history = await buildCompetitionHistory(teams, matches);
// Had to manually merge
```

**After (✅ orchestrated consolidation):**
```typescript
const profiles = await refreshTeamDataForEvent(eventKey);
// Everything merged and saved automatically
```

---

## Future Enhancements

### Phase 2: Auto-Refresh Strategy
- Configurable refresh intervals
- Background updates while app is open
- Sync with service worker for offline-first updates

### Phase 3: Team Comparison
- Side-by-side team ranking views
- Historical trend charts
- Predictive ranking models

### Phase 4: Advanced Analytics
- Team performance clustering
- Alliance recommendation engine
- Multi-year team progression tracking

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/core/types/team-profile.ts` | ~110 | Type definitions |
| `src/core/db/TeamDB.ts` | ~30 | Dexie database class |
| `src/core/db/teamUtils.ts` | ~280 | CRUD operations |
| `src/core/lib/statbotics/teamRankUtils.ts` | ~200 | Statbotics API utils |
| `src/core/lib/tba/competitionHistoryUtils.ts` | ~180 | Match history parsing |
| `src/core/db/teamDataManager.ts` | ~220 | Orchestration/consolidation |
| `src/core/hooks/useTeamProfiles.ts` | ~210 | React hook |
| `src/types/database.ts` | ~30 | Schema documentation |
| **Total** | **~1,260** | **~1.3KB minified** |

---

## Troubleshooting

### Q: Teams not appearing after refresh?
**A:** Check browser console for API errors. Verify event key format (lowercase, e.g., "2026mrcmp"). Ensure TBA API key is set.

### Q: Rankings are stale?
**A:** Rankings cache for 24 hours. Clear cache and refresh: `clearTeamRankingCache()` then `refresh()`.

### Q: Memory growing?
**A:** Hook memoizes results. Make sure component unmounts properly. Use `useCallback` for refresh callbacks.

### Q: Offline mode not working?
**A:** Verify data was cached before going offline. Check IndexedDB in DevTools. If empty, needs at least one online refresh first.

---

## Security Considerations

- **TBA API key:** Use server-side proxy (Netlify function) for production
- **Data sensitivity:** Team rankings are public (from TBA/Statbotics)
- **IndexedDB scope:** Per-origin isolation, no cross-domain access
- **Refresh rate:** Implement rate-limiting on manual refresh (~1 per minute)

---

## Related Documentation

- [Framework Design](./FRAMEWORK_DESIGN.md) — Overall architecture
- [Database Overview](./DATABASE.md) — All databases (MatchScoutingDB, PitScoutingDB, TeamDB)
- [TBA Integration](./TEAM_STATS.md) — How team stats are calculated
- [Hooks Reference](./HOOKS_REFERENCE.md) — All available hooks

