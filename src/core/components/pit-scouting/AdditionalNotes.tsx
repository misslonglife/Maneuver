import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { FileText } from 'lucide-react';

interface NotesObject {
  general?: string;
  sponsors?: string;
  outreach?: string;
  uniqueMechanisms?: string;
  autoReport?: string;
}

interface AdditionalNotesProps {
  notes?: NotesObject;
  onNotesChange: (value: NotesObject) => void;
}

export function AdditionalNotes({ notes = {}, onNotesChange }: AdditionalNotesProps) {
  const handleFieldChange = (field: keyof NotesObject, value: string | undefined) => {
    onNotesChange({
      ...notes,
      [field]: value || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Additional Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General Observations */}
        <div className="space-y-2">
          <Label htmlFor="general">General Observations</Label>
          <Textarea
            id="general"
            placeholder="Any additional observations about the robot, team, or strategy..."
            value={notes.general ?? ''}
            onChange={e => handleFieldChange('general', e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Unique Mechanisms */}
        <div className="space-y-2">
          <Label htmlFor="uniqueMechanisms">Unique Mechanisms (ASK & OBSERVE)</Label>
          <Textarea
            id="uniqueMechanisms"
            placeholder="Any unusual or innovative mechanical designs observed..."
            value={notes.uniqueMechanisms ?? ''}
            onChange={e => handleFieldChange('uniqueMechanisms', e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Auto Report */}
        <div className="space-y-2">
          <Label htmlFor="autoReport">Autonomous Route/Path (ASK)</Label>
          <Textarea
            id="autoReport"
            placeholder="What the team reports about their autonomous capabilities..."
            value={notes.autoReport ?? ''}
            onChange={e => handleFieldChange('autoReport', e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Sponsors */}
        <div className="space-y-2">
          <Label htmlFor="sponsors">Sponsors & Partners (OBSERVE ONLY)</Label>
          <Textarea
            id="sponsors"
            placeholder="(NON-LOCAL) Notable sponsors or partner companies displayed on robot..."
            value={notes.sponsors ?? ''}
            onChange={e => handleFieldChange('sponsors', e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Outreach */}
        <div className="space-y-2">
          <Label htmlFor="outreach">Outreach & Team Culture (OBSERVE ONLY)</Label>
          <Textarea
            id="outreach"
            placeholder="Team culture, community engagement, or notable outreach efforts..."
            value={notes.outreach ?? ''}
            onChange={e => handleFieldChange('outreach', e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Optional: All fields are optional. Fill in any details that may be relevant for strategy
          or match planning.
        </p>
      </CardContent>
    </Card>
  );
}
