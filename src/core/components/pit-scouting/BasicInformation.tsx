import { useEffect, useState } from "react";
import { Label } from "@/core/components/ui/label";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { EventNameSelector } from "@/core/components/GameStartComponents/EventNameSelector";
import { User, Hash, Calendar, FolderOpen, ClipboardList } from "lucide-react";
import { TeamCard } from "@/core/components/team";
import { loadTeamProfile } from "@/core/db/teamUtils";
import type { TeamProfile } from "@/core/types/team-profile";

interface BasicInformationProps {
  teamNumber: number | "";
  eventKey: string;
  scoutName: string;
  onTeamNumberChange: (value: number | "") => void;
  onEventKeyChange: (value: string) => void;
  onScoutNameChange: (value: string) => void;
  onLoadExisting?: () => void;
  isLoading?: boolean;
  onOpenAssignedTeams?: () => void;
  assignedTeamsCount?: number;
  completedAssignedCount?: number;
}

export function BasicInformation({
  teamNumber,
  eventKey,
  scoutName,
  onTeamNumberChange,
  onEventKeyChange,
  onScoutNameChange,
  onLoadExisting,
  isLoading = false,
  onOpenAssignedTeams,
  assignedTeamsCount = 0,
  completedAssignedCount = 0,
}: BasicInformationProps) {
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  // Fetch team profile when team number changes
  useEffect(() => {
    const fetchTeamProfile = async () => {
      if (teamNumber === "") {
        setTeamProfile(null);
        return;
      }

      setIsLoadingTeam(true);
      try {
        const profile = await loadTeamProfile(teamNumber);
        setTeamProfile(profile || null);
      } catch (error) {
        console.error(`Failed to load team profile for team ${teamNumber}:`, error);
        setTeamProfile(null);
      } finally {
        setIsLoadingTeam(false);
      }
    };

    fetchTeamProfile();
  }, [teamNumber]);

  const handleTeamNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      onTeamNumberChange("");
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        onTeamNumberChange(numValue);
      }
    }
  };

  const canLoadExisting = teamNumber !== "" && eventKey !== "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <div className="flex items-center gap-2">
            {onOpenAssignedTeams && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAssignedTeams}
                className="gap-2"
                aria-label="Open assigned teams"
                title="Open assigned teams"
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Assigned Teams</span>
                <Badge variant="secondary" className="inline-flex tabular-nums">
                  {completedAssignedCount}/{assignedTeamsCount}
                </Badge>
              </Button>
            )}

            {onLoadExisting && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadExisting}
                disabled={isLoading || !canLoadExisting}
                className="gap-2"
                aria-label="Load existing"
                title="Load existing"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Load Existing</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Number Input */}
        <div className="space-y-2">
          <Label htmlFor="teamNumber" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Team Number *
          </Label>
          <Input
            id="teamNumber"
            type="number"
            placeholder="e.g., 3314"
            value={teamNumber === "" ? "" : teamNumber}
            onChange={handleTeamNumberChange}
            min="1"
            step="1"
            required
            className="text-lg"
          />
        </div>

        {/* Event Selector */}
        <div className="space-y-2">
          <Label htmlFor="eventKey" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Event *
          </Label>
          <EventNameSelector
            currentEventKey={eventKey}
            onEventKeyChange={onEventKeyChange}
          />
        </div>

        {/* Scout Name Input */}
        <div className="space-y-2">
          <Label htmlFor="scoutName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Scout Name *
          </Label>
          <Input
            id="scoutName"
            type="text"
            placeholder="Your name"
            value={scoutName}
            onChange={(e) => onScoutNameChange(e.target.value)}
            required
            className="text-lg"
          />
        </div>

        {/* Team Card Display */}
        {teamProfile && !isLoadingTeam && (
          <div className="mt-6 pt-4 border-t">
            <TeamCard team={teamProfile} />
          </div>
        )}

        {/* Loading State */}
        {isLoadingTeam && (
          <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
            Loading team information...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
