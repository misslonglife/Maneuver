# Team Database Integration Guide

**How to Use the Team Database in Your Components**

---

## Quick Start (5 minutes)

### 1. Basic Team Loading

```typescript
import { useTeamProfiles } from '@/hooks';

function MyComponent() {
  // Load teams for an event
  const { profiles, isLoading, error } = useTeamProfiles({
    eventKey: '2026mrcmp'
  });

  if (isLoading) return <div>Loading teams...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {profiles.map(team => (
        <div key={team.teamNumber}>
          {team.name} (Rank #{team.statbotics?.globalRank})
        </div>
      ))}
    </div>
  );
}
```

### 2. Single Team Lookup

```typescript
import { useTeamProfile } from '@/hooks';

function TeamCard({ teamNumber }) {
  const { profile, isLoading } = useTeamProfile(teamNumber);

  if (!profile) return null;

  return (
    <div>
      <h3>{profile.name}</h3>
      <p>Country: {profile.country}</p>
      <p>Rank: #{profile.statbotics?.globalRank} (top {profile.statbotics?.globalPercentile}%)</p>
    </div>
  );
}
```

### 3. Manual Refresh

```typescript
import { useTeamProfiles } from '@/hooks';

function RefreshButton() {
  const { refresh, isLoading } = useTeamProfiles({ eventKey: '2026mrcmp' });

  return (
    <button onClick={() => refresh()} disabled={isLoading}>
      {isLoading ? 'Refreshing...' : 'Refresh Team Data'}
    </button>
  );
}
```

---

## Common Patterns

### Pattern: Team List with Filtering

```typescript
function TeamListPage() {
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const { profiles, isLoading } = useTeamProfiles({ eventKey: '2026mrcmp' });

  const filtered = selectedCountry
    ? profiles.filter(t => t.country === selectedCountry)
    : profiles;

  return (
    <div>
      <select onChange={e => setSelectedCountry(e.target.value)}>
        <option value="">All Countries</option>
        {[...new Set(profiles.map(t => t.country))]
          .filter(Boolean)
          .map(country => (
            <option key={country} value={country}>{country}</option>
          ))}
      </select>

      <table>
        <thead>
          <tr>
            <th>Team #</th>
            <th>Name</th>
            <th>Country</th>
            <th>Global Rank</th>
            <th>Wins</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(team => (
            <tr key={team.teamNumber}>
              <td>{team.teamNumber}</td>
              <td>{team.name}</td>
              <td>{team.country}</td>
              <td>
                {team.statbotics?.globalRank 
                  ? `#${team.statbotics.globalRank}` 
                  : 'N/A'}
              </td>
              <td>{team.aggregateWins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Pattern: Event-Specific Rankings

```typescript
function EventRankingsPage() {
  const [eventKey, setEventKey] = useState('2026mrcmp');
  const { profiles, refresh } = useTeamProfiles({ eventKey });

  // Extract rankings for this specific event only
  const eventRankings = profiles
    .map(team => {
      const eventRecord = team.competitionHistory.find(r => r.eventKey === eventKey);
      return {
        teamNumber: team.teamNumber,
        name: team.name,
        rank: eventRecord?.statboticsRank,
        wins: eventRecord?.wins ?? 0,
        losses: eventRecord?.losses ?? 0,
      };
    })
    .filter(t => t.rank !== undefined)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  return (
    <div>
      <input 
        value={eventKey} 
        onChange={e => setEventKey(e.target.value)}
        placeholder="2026mrcmp"
      />
      <button onClick={() => refresh()}>Refresh</button>

      <ol>
        {eventRankings.map(team => (
          <li key={team.teamNumber}>
            {team.name} — {team.wins}W-{team.losses}L
          </li>
        ))}
      </ol>
    </div>
  );
}
```

### Pattern: Team Comparison

```typescript
function CompareTeamsPage() {
  const [teamNumbers, setTeamNumbers] = useState([3314, 254, 1690]);
  const { profiles } = useTeamProfiles({
    teamNumbers,
    includeRankings: true,
    includeHistory: true,
  });

  const teamMap = new Map(profiles.map(t => [t.teamNumber, t]));

  return (
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          {teamNumbers.map(num => (
            <th key={num}>{teamMap.get(num)?.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Global Rank</td>
          {teamNumbers.map(num => (
            <td key={num}>
              #{teamMap.get(num)?.statbotics?.globalRank}
            </td>
          ))}
        </tr>
        <tr>
          <td>Country</td>
          {teamNumbers.map(num => (
            <td key={num}>{teamMap.get(num)?.country}</td>
          ))}
        </tr>
        <tr>
          <td>Total Wins</td>
          {teamNumbers.map(num => (
            <td key={num}>{teamMap.get(num)?.aggregateWins}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
```

### Pattern: Conditional Loading

```typescript
function SmartTeamView({ eventKey, autoRefresh = false }) {
  const { profiles, isLoading, error, refresh, stats } = useTeamProfiles({
    eventKey,
    autoRefresh,
  });

  return (
    <div>
      {/* Show loading skeleton */}
      {isLoading && <SkeletonLoader count={5} />}

      {/* Show error with retry */}
      {error && (
        <ErrorBoundary 
          message={`Failed to load teams: ${error.message}`}
          onRetry={() => refresh()}
        />
      )}

      {/* Show stats */}
      {!isLoading && stats && (
        <Stats>
          Total Teams: {stats.totalTeams}
          With Rankings: {stats.teamsWithRankings}
          With History: {stats.teamsWithHistory}
        </Stats>
      )}

      {/* Show data when ready */}
      {!isLoading && profiles.length > 0 && (
        <TeamList teams={profiles} />
      )}
    </div>
  );
}
```

---

## Advanced Patterns

### Pattern: React Context Integration

```typescript
import { createContext, useContext } from 'react';
import { useTeamProfiles } from '@/hooks';
import type { TeamProfile } from '@/core/types';

interface TeamContextType {
  profiles: TeamProfile[];
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

const TeamContext = createContext<TeamContextType | null>(null);

export function TeamProvider({ eventKey, children }) {
  const { profiles, refresh, isLoading, error } = useTeamProfiles({ eventKey });

  return (
    <TeamContext.Provider value={{ profiles, refresh, isLoading, error }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeams must be used within TeamProvider');
  }
  return context;
}

// Usage:
function App() {
  return (
    <TeamProvider eventKey="2026mrcmp">
      <SidebarWithTeams />
      <MainContent />
    </TeamProvider>
  );
}
```

### Pattern: Caching Before Navigation

```typescript
function useTeamCachePreload(eventKey: string) {
  const { refresh } = useTeamProfiles({ eventKey });

  const preload = useCallback(async () => {
    try {
      await refresh();
      // Data now cached in TeamDB
    } catch (error) {
      console.warn('Failed to preload teams:', error);
    }
  }, [refresh, eventKey]);

  return preload;
}

// Usage: Preload teams when selecting event
function EventSelector() {
  const preload = useTeamCachePreload('2026mrcmp');

  return (
    <select onChange={async e => {
      const eventKey = e.target.value;
      await preload(); // Preload before navigation
      navigate(`/event/${eventKey}`);
    }}>
      <option value="2026mrcmp">Michigan Regional</option>
      <option value="2026sand">San Diego</option>
    </select>
  );
}
```

### Pattern: Streaming Data Load

```typescript
function ProgressiveTeamLoad() {
  const [loadedCount, setLoadedCount] = useState(0);
  const { profiles } = useTeamProfiles({
    eventKey: '2026mrcmp',
    includeRankings: true,
    includeHistory: true, // This is slower
  });

  // Simulate progressive loading
  useEffect(() => {
    if (profiles.length > 0) {
      const interval = setInterval(() => {
        setLoadedCount(prev => Math.min(prev + 10, profiles.length));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [profiles.length]);

  return (
    <div>
      <progress value={loadedCount} max={profiles.length} />
      <div className="grid">
        {profiles.slice(0, loadedCount).map(team => (
          <TeamCard key={team.teamNumber} team={team} />
        ))}
      </div>
    </div>
  );
}
```

---

## API Reference

### `useTeamProfiles(options)`

**Load team profiles from database with optional filtering.**

```typescript
const {
  profiles,      // TeamProfile[]
  isLoading,     // boolean
  error,         // Error | null
  refresh,       // async () => void
  stats,         // { totalTeams, teamsWithRankings, teamsWithHistory }
} = useTeamProfiles({
  eventKey?: string;        // Filter by specific event
  teamNumbers?: number[];   // Specific teams to load
  autoRefresh?: boolean;    // Auto-refresh on mount (default: false)
  includeRankings?: boolean; // Include Statbotics data (default: true)
  includeHistory?: boolean;  // Include competition history (default: true)
});
```

### `useTeamProfile(teamNumber)`

**Load single team profile.**

```typescript
const {
  profile,   // TeamProfile | null
  isLoading, // boolean
  error,     // Error | null
  refresh,   // async () => void
} = useTeamProfile(teamNumber);
```

### `useTeamsForEvent(eventKey)`

**Load teams for specific event.**

```typescript
const { profiles, isLoading, error, refresh } = useTeamsForEvent('2026mrcmp');
```

---

## Direct Database Access

For advanced use cases, access the database directly:

```typescript
import {
  loadTeamProfiles,
  loadTeamsByEvent,
  loadTeamProfile,
  saveTeamProfile,
  updateTeamRanking,
  updateCompetitionHistory,
  clearAllTeamProfiles,
  getTeamDBStats,
} from '@/core/db/teamUtils';
import { refreshTeamDataForEvent } from '@/core/db/teamDataManager';

// Load teams
const teams = await loadTeamsByEvent('2026mrcmp');
const team = await loadTeamProfile(3314);

// Manual updates (if data changes externally)
await updateTeamRanking(3314, 15, 45.5);
await updateCompetitionHistory(3314, '2026mrcmp', {
  wins: 8,
  losses: 2,
  ties: 0,
  avgRank: 12.5,
});

// Orchestrated refresh (recommended)
const profiles = await refreshTeamDataForEvent('2026mrcmp', apiKey);

// Statistics
const stats = await getTeamDBStats();
console.log(`${stats.totalTeams} teams, ${stats.teamsWithRankings} with rankings`);
```

---

## Error Handling

```typescript
function RobustTeamComponent() {
  const { profiles, error, refresh } = useTeamProfiles({ eventKey: '2026mrcmp' });

  // Handle different error scenarios
  if (error?.message.includes('API') {
    return (
      <ErrorCard type="network">
        <p>Failed to fetch from API</p>
        <button onClick={() => refresh()}>Retry Online</button>
      </ErrorCard>
    );
  }

  if (error?.message.includes('database')) {
    return (
      <ErrorCard type="storage">
        <p>Failed to save to local database</p>
        <p>Try clearing cookies and refreshing</p>
      </ErrorCard>
    );
  }

  return <TeamList teams={profiles} />;
}
```

---

## Testing

### Unit Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTeamProfiles } from '@/hooks';

describe('useTeamProfiles', () => {
  it('loads teams from cache', async () => {
    const { result } = renderHook(() => 
      useTeamProfiles({ eventKey: '2026mrcmp' })
    );

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      // Wait for hook to load from cache
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.profiles.length).toBeGreaterThan(0);
  });

  it('refreshes data on demand', async () => {
    const { result } = renderHook(() => 
      useTeamProfiles({ eventKey: '2026mrcmp' })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
  });
});
```

### Integration Testing

```typescript
describe('Team Database Integration', () => {
  beforeEach(async () => {
    // Clear database before each test
    await clearAllTeamProfiles();
  });

  it('consolidates TBA and Statbotics data', async () => {
    const profiles = await refreshTeamDataForEvent('2026sand', apiKey);
    
    expect(profiles).toHaveLength(40); // Sand event has 40 teams
    
    const team = profiles[0];
    expect(team.name).toBeDefined();
    expect(team.statbotics?.globalRank).toBeDefined();
    expect(team.competitionHistory.length).toBeGreaterThan(0);
  });
});
```

---

## Performance Tips

1. **Avoid loading entire season unnecessarily:**
   ```typescript
   // ❌ Don't do this on every page load
   const { profiles } = useTeamProfiles(); // Loads all teams for all events
   
   // ✅ Do this - load only what you need
   const { profiles } = useTeamProfiles({ eventKey });
   ```

2. **Memoize event key selections:**
   ```typescript
   const eventKey = useMemo(() => selectedEvent, [selectedEvent]);
   const { profiles } = useTeamProfiles({ eventKey });
   ```

3. **Lazy-load competition history only when needed:**
   ```typescript
   // Don't always include history
   const { profiles } = useTeamProfiles({
     eventKey,
     includeHistory: expandedTeam === teamNumber,
   });
   ```

4. **Use stats to monitor cache completeness:**
   ```typescript
   const { stats } = useTeamProfiles({ eventKey });
   if (stats.teamsWithRankings < stats.totalTeams) {
     // Show "incomplete data" indicator
   }
   ```

---

## Migration Checklist

When migrating from old team loading pattern:

- [ ] Replace all `localStorage.getItem('tba_teams_*')` with `useTeamProfiles()`
- [ ] Remove manual `fetch()` calls to team APIs
- [ ] Remove `useState` for storing team lists
- [ ] Update error boundaries to use hook's `error` prop
- [ ] Add loading skeletons using hook's `isLoading` flag
- [ ] Test offline functionality (data should still load from cache)
- [ ] Verify no duplicate team fetches in DevTools Network tab
- [ ] Check browser IndexedDB to confirm TeamDB has data
- [ ] Remove any manual localStorage cleanup code (new system handles this)

---

## Getting Help

**Issues or Questions?**

1. Check the [Team Database Architecture](./TEAM_DATABASE.md) doc
2. Review [troubleshooting section](./TEAM_DATABASE.md#troubleshooting)
3. Look at test examples in `src/core/hooks/useTeamProfiles.test.ts` (when available)
4. Check Framework Design doc for context on how this fits the bigger picture

