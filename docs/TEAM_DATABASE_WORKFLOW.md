# Team Database Data Flow & Workflow

**Complete documentation of how team profile data flows through the system**

---

## Table of Contents

1. [Data Flow Diagram](#data-flow-diagram)
2. [User Workflows](#user-workflows)
3. [Component Architecture](#component-architecture)
4. [State Management](#state-management)
5. [Integration Points](#integration-points)

---

## Data Flow Diagram

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User Interface Layer                                        │
├─────────────────────────────────────────────────────────────┤
│ EventConfiguration  DataTypeSelector  DataOperationsCard    │
└────────────┬────────────────┬──────────────────┬────────────┘
             │                │                  │
             ▼                ▼                  ▼
        eventKey        dataType='event-teams'  onLoadEventTeams()
             │                │                  │
             └────────────────┼──────────────────┘
                              │
        ┌─────────────────────▼──────────────────────┐
        │ Parent Component (e.g., TBADataPage)       │
        │ - Manages event state                      │
        │ - Manages loading states                   │
        │ - Handles user actions                     │
        └────────┬─────────────────────────┬─────────┘
                 │                         │
                 │ calls refresh()         │ displays teams
                 │                         │
        ┌────────▼──────────────┐  ┌──────▼──────────────────┐
        │ teamDataManager.ts    │  │ EventTeamDisplay/       │
        │ refreshTeamDataFor    │  │ useTeamProfiles Hook    │
        │ Event()               │  └──────┬──────────────────┘
        └────────┬──────────────┘         │
                 │                        │
    ┌────────────┴────────────┬───────────┴────────────┐
    │                         │                        │
    ▼                         ▼                        ▼
TBA API          Statbotics API           IndexedDB (TeamDB)
- Team list      - Rankings               - Caches all teams
- Match results  - Percentiles            - Quick local access
- Breakdowns     - Event-specific ranks   - Offline support
```

---

## User Workflows

### Workflow 1: Load Event Teams (Complete Flow)

**Goal:** User wants to load all team profiles for an event

**Steps:**

1. **Configuration Phase**
   - User enters Event Key: `2026mrcmp`
   - System validates event key format
   - User selects data type: `event-teams`

2. **Load Phase** (User clicks "Load Event Teams")
   ```
   DataOperationsCard.onLoadEventTeams()
   └─> Parent component calls:
       └─> refreshTeamDataForEvent('2026mrcmp')
           │
           ├─> 1. Fetch TBA team list for event
           │      GET /api/v3/event/2026mrcmp/teams
           │      └─> Returns: [{ key: 'frc3314', name: '...' }, ...]
           │
           ├─> 2. Fetch Statbotics rankings for each team (5 concurrent)
           │      GET /statbotics/...
           │      └─> Returns: { globalRank, globalPercentile, ... }
           │
           ├─> 3. Load cached TBA match data
           │      FROM IndexedDB tbaCache
           │      └─> Returns: [...matches]
           │
           ├─> 4. Build competition history from matches
           │      FOR each team:
           │        - Extract wins/losses/ties from event matches
           │        - Calculate rankings, trends
           │        - Aggregate across events
           │      └─> Returns: CompetitionRecord[]
           │
           └─> 5. Consolidate into TeamProfile objects
               ├─> Merge TBA data + Statbotics + History
               ├─> Save to TeamDB
               │   │
               │   └─> IndexedDB.teamProfiles.bulkPut()
               │
               └─> Return: TeamProfile[]
   ```

3. **Display Phase**
   ```
   Parent component receives TeamProfile[]
   └─> Passes eventKey to display component
       └─> EventTeamProfilesCard
           │
           └─> Uses useTeamProfiles({ eventKey })
               │
               ├─> Effect 1: Load from TeamDB
               │    FROM IndexedDB using loadTeamsByEvent(eventKey)
               │    └─> Sets profiles state
               │
               └─> Returns: { profiles[], isLoading, error, refresh() }
                   │
                   └─> Component renders team list with:
                       - Search/filter
                       - Sort options
                       - Expanded details per team
                       - Stats summary
   ```

---

### Workflow 2: View Single Team Details

**Goal:** User clicks on a team in list to see full profile

**Steps:**

1. Team row expands in display component
2. Shows full details:
   - Global ranking + percentile
   - Event-specific ranking (if available)
   - Win/loss/tie record
   - All competition history
   - School/location info
3. User can click "Refresh" to update just that team's data

---

### Workflow 3: Refresh Team Data

**Goal:** Update team rankings and history from latest API data

**Steps:**

1. User clicks "Refresh from API" in display card
2. System calls `refresh()` function from hook
3. Hook calls `refreshTeamDataForEvent()` again
4. Fresh data replaces old data in TeamDB
5. Component updates to show fresh rankings/history

---

## Component Architecture

### Components in Data Management Hierarchy

```
TBADataPage (Parent)
├─ EventConfiguration
│  ├─ EventKeyInput
│  └─ DataTypeSelector
│
├─ DataOperationsCard
│  └─ Shows load buttons for current dataType
│
└─ Display Component (changes based on dataType)
   ├─ MatchDataDisplay (if dataType='match-data')
   ├─ MatchResultsDisplay (if dataType='match-results')
   ├─ EventTeamProfilesCard (if dataType='event-teams') ← NEW
   ├─ MatchValidationDataDisplay (if validation)
   └─ PitDataDisplay (if pit-data)
```

### EventTeamProfilesCard Component

**Purpose:** Displays all teams for an event with search, filter, sort

**Props:**
```typescript
interface EventTeamProfilesCardProps {
  eventKey: string;           // Event to load teams for
  onLoadComplete?: () => void; // Callback after load
}
```

**Internal State:**
- `profiles`: TeamProfile[] - Loaded teams from hook
- `searchQuery`: string - User search filter
- `sortBy`: 'rank' | 'name' | 'number'
- `expandedTeam`: number | null - Currently expanded team

**Behavior:**
- On mount: Calls `useTeamProfiles({ eventKey })`
- Renders loading state while loading
- Shows search/filter/sort controls
- Renders team rows (collapsed by default)
- On row click: Expand to show full details
- "Refresh" button available to update from API

---

## State Management

### State Layers

```
IndexedDB (TeamDB)
├─ Persistent storage
├─ Source of truth
└─ Survives reload

      ↕ (sync via hooks)

React Component State
├─ profiles: TeamProfile[]
├─ isLoading: boolean
├─ error: Error | null
└─ stats: { totalTeams, ... }

      ↕ (derived from)

useTeamProfiles Hook
├─ Loads from TeamDB on mount
├─ Provides refresh() for API calls
└─ Handles error states

      ↕ (updates)

UI Display
├─ Search/filter
├─ Sort
└─ Expand/collapse
```

### State Flow Example

```
1. User navigates to TBADataPage
   └─> Sets eventKey = '2026mrcmp'

2. Parent component calls:
   └─> await refreshTeamDataForEvent('2026mrcmp')
       └─> Saves 50 TeamProfile objects to IndexedDB

3. EventTeamProfilesCard mounts
   └─> useTeamProfiles({ eventKey: '2026mrcmp' }) initializes
       └─> loadTeamsByEvent('2026mrcmp') executes
           └─> Queries IndexedDB: teamProfiles where eventKey='2026mrcmp'
               └─> Returns 50 profiles
                   └─> Component state.profiles = [50 profiles]
                       └─> UI renders team list

4. User clicks Refresh
   └─> refresh() function called
       └─> refreshTeamDataForEvent('2026mrcmp') runs
           └─> Fetches latest data from TBA+ Statbotics
               └─> Saves to TeamDB (overwrites old)
                   └─> Hook detects change (useEffect watches TeamDB)
                       └─> Reloads from database
                           └─> UI updates with fresh data
```

---

## Integration Points

### 1. EventConfiguration → Parent Component

**Flow:**
```typescript
// Component:
<EventConfiguration 
  eventKey={eventKey}
  onEventKeyChange={(key) => setEventKey(key)}
/>

// Parent receives:
eventKey: string = '2026mrcmp'
```

### 2. DataTypeSelector → DataOperationsCard

**Flow:**
```typescript
// Component:
<DataTypeSelector
  dataType={dataType}
  setDataType={(type) => setDataType(type)}
/>

// DataOperationsCard gets:
dataType: 'event-teams' | 'match-data' | ...
```

### 3. DataOperationsCard → Parent (Event Handlers)

**Flow:**
```typescript
// Parent defines handlers:
const handleLoadEventTeams = async () => {
  setEventTeamsLoading(true);
  try {
    const teams = await refreshTeamDataForEvent(eventKey, apiKey);
    setTeamProfiles(teams); // Store for display
  } finally {
    setEventTeamsLoading(false);
  }
};

// Passes to component:
<DataOperationsCard
  onLoadEventTeams={handleLoadEventTeams}
  eventTeamsLoading={eventTeamsLoading}
/>
```

### 4. Display Component → Hook → Database

**Flow:**
```typescript
// EventTeamProfilesCard:
const { profiles, isLoading, error, refresh } = useTeamProfiles({
  eventKey,
});

// useTeamProfiles Hook:
- On mount: loadTeamsByEvent(eventKey)
- On refresh: refreshTeamDataForEvent(eventKey)
- Provides profiles[] to component

// Database:
- IndexedDB.teamProfiles.where('competitionHistory.eventKey').equals(eventKey)
- Returns filtered TeamProfile[]
```

### 5. Refresh Flow

**Flow:**
```typescript
// User clicks Refresh button
onClick={refresh}
  └─> refresh() from useTeamProfiles
      └─> refreshTeamDataForEvent(eventKey, apiKey)
          ├─> Makes API calls (TBA + Statbotics)
          └─> Saves to IndexedDB
              └─> Hook's useEffect detects change
                  └─> Calls loadTeamsByEvent()
                      └─> Updates component state
                          └─> UI re-renders
```

---

## Data Models

### Team Profile in Database

```typescript
// Stored in IndexedDB.teamProfiles
{
  teamNumber: 3314,
  name: 'Team 3314 Exploding Bacon',
  country: 'USA',
  state: 'Michigan',
  
  // Statbotics data
  statbotics: {
    globalRank: 15,
    globalPercentile: 45.5,
    eventRank: 5,      // For current event
    eventPercentile: 72.1,
  },
  
  // Competition history (multiple events)
  competitionHistory: [
    {
      eventKey: '2026mrcmp',
      eventName: 'Michigan Regional',
      wins: 8,
      losses: 2,
      ties: 0,
      avgRank: 12.5,
      ...
    },
    {
      eventKey: '2026sand',
      eventName: 'San Diego Regional',
      wins: 6,
      ...
    },
  ],
  
  // Aggregate stats
  aggregateWins: 14,
  aggregateLosses: 4,
  aggregateTies: 0,
  
  // Metadata
  createdAt: 1646000000000,
  lastUpdatedAt: 1646100000000,
  dataSource: 'merged',
}
```

### Query Examples

```typescript
// Find all teams for event
const teamsForEvent = await loadTeamsByEvent('2026mrcmp');
// ← Returns TeamProfile[] where competitionHistory includes eventKey

// Find top 20 teams globally
const topTeams = allTeams
  .filter(t => t.statbotics?.globalRank)
  .sort((a, b) => 
    (a.statbotics?.globalRank ?? 999) - 
    (b.statbotics?.globalRank ?? 999)
  )
  .slice(0, 20);

// Find teams with best record at event
const teamsAtEvent = await loadTeamsByEvent('2026mrcmp');
const bestRecords = teamsAtEvent
  .sort((a, b) => {
    const aWinRate = a.aggregateWins / (a.aggregateWins + a.aggregateLosses);
    const bWinRate = b.aggregateWins / (b.aggregateWins + b.aggregateLosses);
    return bWinRate - aWinRate;
  });
```

---

## Performance Characteristics

| Operation | Time | Bottleneck |
|-----------|------|-----------|
| Load from IndexedDB | 10-50ms | Database size |
| Render 50 teams | 100-200ms | DOM nodes |
| Search filter | 1-5ms | Array filter |
| Refresh from API (50 teams) | 2-5 seconds | Network + Statbotics rate limit |
| Save to IndexedDB | 50-100ms | Bulk put operation |

---

## Error Handling

### Network Errors

```
refreshTeamDataForEvent() fails
└─> Error caught in hook
    └─> setError(error)
        └─> Component shows Alert with message
            └─> "Failed to load team profiles"
            └─> User can retry or use cached data
```

### Database Errors

```
IndexedDB.teamProfiles.where(...) fails
└─> Error caught in loadTeamsByEvent()
    └─> Thrown to hook
        └─> Caught in useTeamProfiles try/catch
            └─> setError(error)
                └─> Component shows error UI
```

### Missing Data

```
Team loaded but no Statbotics ranking available
└─> statbotics field is undefined
    └─> Component skips ranking display
        └─> Shows "N/A" or "-" in UI
            └─> User triggered refresh to fetch
```

---

## Future Enhancements

### Phase 2

- [ ] Auto-refresh on interval (configurable)
- [ ] Batch team updates (update only changed teams)
- [ ] Conflict resolution for concurrent updates
- [ ] Team comparison view

### Phase 3

- [ ] Team analytics (trend analysis, momentum)
- [ ] Predictive rankings
- [ ] Multi-device sync with conflict resolution
- [ ] Export team data (CSV, PDF)

---

## Troubleshooting

### Teams not showing up after refresh

1. Check IndexedDB: Open DevTools → Application → IndexedDB → TeamDB
2. Verify teamProfiles table has data
3. Check that eventKey in teams matches filter eventKey
4. Try clearing database and refreshing again

### API errors during refresh

1. Check TBA API status
2. Verify API key in settings
3. Check rate limits (Statbotics: 5 requests/second)
4. Look at browser console for detailed errors: `[useTeamProfiles] Failed to refresh`

### Stale data displayed

1. Click "Refresh from API" button
2. Check lastUpdatedAt timestamp in team profile
3. Verify API calls completed successfully (no network errors)
4. Check browser cache settings

