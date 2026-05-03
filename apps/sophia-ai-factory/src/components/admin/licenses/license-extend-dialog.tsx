'use client';

/**
 * License Extend Dialog Component
 * Dialog to extend license expiration with duration picker (7/30/90/180/365 days)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import { Label } from '@/seed/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import { CheckCircle2, Calendar } from 'lucide-react';

interface LicenseExtendDialogProps {
  licenseId: string;
  onExtend: (id: string, days: number) => void | Promise<void>;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { value: '7', label: '7 days', days: 7 },
  { value: '30', label: '30 days (1 month)', days: 30 },
  { value: '90', label: '90 days (3 months)', days: 90 },
  { value: '180', label: '180 days (6 months)', days: 180 },
  { value: '365', label: '365 days (1 year)', days: 365 },
  { value: '730', label: '730 days (2 years)', days: 730 },
];

export function LicenseExtendDialog({ licenseId, onExtend, onClose }: LicenseExtendDialogProps) {
  const [selectedDays, setSelectedDays] = useState<string>('30');
  const [extending, setExtending] = useState(false);

  const handleExtend = async () => {
    setExtending(true);
    try {
      const days = parseInt(selectedDays, 10);
      await onExtend(licenseId, days);
    } finally {
      setExtending(false);
    }
  };

  const selectedOption = DURATION_OPTIONS.find(opt => opt.value === selectedDays);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Calendar className="w-5 h-5 text-[var(--neon-cyan)]" />
            Extend License Key
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add more time to this license expiration date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              <strong>Extension Benefits:</strong> Customer retains access to all features for the extended period.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="license-id" className="text-foreground">
              License ID
            </Label>
            <div className="font-mono text-sm bg-muted p-2 rounded border border-border text-[var(--neon-cyan)]">
              {licenseId.slice(0, 12)}...
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="text-foreground">
              Extension Duration
            </Label>
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger id="duration" className="bg-muted border-border text-foreground mt-1">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedOption?.label} will be added to the current expiration date
            </p>
          </div>

          {selectedDays && (
            <div className="p-3 bg-muted border border-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Extension:</span>
                <span className="text-sm font-semibold text-[var(--neon-cyan)]">
                  +{selectedOption?.days} days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Expiration:</span>
                <span className="text-sm text-foreground">
                  {new Date(Date.now() + (selectedOption ? selectedOption.days : 30) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This action will be logged in the audit trail for compliance purposes.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={extending}
            className="border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExtend}
            disabled={extending}
            className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white"
          >
            {extending ? 'Extending...' : `Extend +${selectedOption?.days} days`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
