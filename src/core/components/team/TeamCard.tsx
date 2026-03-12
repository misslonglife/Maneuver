import { TeamProfile } from '@/core/types/team-profile';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/core/components/ui/card';

interface TeamCardProps {
  team: TeamProfile;
}

/**
 * TeamCard - Reusable presentational component for displaying team information
 * 
 * Displays:
 * - Team identity (number + nickname)
 * - Location (school, city, state, country)
 * - Statbotics rankings (if available)
 * - Competition record (W/L/T, win rate)
 * 
 * This is a presentational component - it does not fetch data itself.
 * Pass a fully populated TeamProfile object as props.
 */
export function TeamCard({ team }: TeamCardProps) {
  const winRate =
    team.aggregateWins !== undefined &&
    team.aggregateLosses !== undefined &&
    team.aggregateTies !== undefined
      ? (
          (team.aggregateWins /
            (team.aggregateWins + team.aggregateLosses + team.aggregateTies)) *
          100
        ).toFixed(1)
      : null;

  return (
    <Card>
      {/* Header: Team Identity */}
      <CardHeader>
        <CardTitle>
          Team {team.teamNumber}
          {team.nickname && ` - ${team.nickname}`}
        </CardTitle>
      </CardHeader>

      {/* Content: Location, Rankings, Competition Record */}
      <CardContent className="space-y-6">
        {/* Location Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Location
          </h3>
          <div className="space-y-1 text-sm">
            {team.schoolName && <div>{team.schoolName}</div>}
            <div>
              {[team.city, team.state, team.country]
                .filter(Boolean)
                .join(', ')}
            </div>
          </div>
        </div>

        {/* Statbotics Rankings Section */}
        {team.statbotics && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Statbotics Rankings
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                Global Rank:{' '}
                <span className="font-semibold">
                  #{team.statbotics.globalRank}
                </span>
              </div>
              <div>
                Global Percentile:{' '}
                <span className="font-semibold">
                  {team.statbotics.globalPercentile.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Competition Record Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Competition Record
          </h3>
          <div className="space-y-1 text-sm">
            <div>
              Record:{' '}
              <span className="font-semibold">
                {team.aggregateWins ?? 0}W -{' '}
                {team.aggregateLosses ?? 0}L -{' '}
                {team.aggregateTies ?? 0}T
              </span>
            </div>
            {winRate && (
              <div>
                Win Rate:{' '}
                <span className="font-semibold">{winRate}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
