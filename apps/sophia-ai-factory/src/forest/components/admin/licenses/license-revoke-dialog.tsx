'use client';

/**
 * License Revoke Dialog Component
 * Confirmation dialog with optional reason input for license revocation
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
import { Textarea } from '@/seed/components/ui/textarea';
import { Label } from '@/seed/components/ui/label';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import { Ban, AlertTriangle } from 'lucide-react';

interface LicenseRevokeDialogProps {
  licenseId: string;
  onRevoke: (id: string, reason?: string) => void | Promise<void>;
  onClose: () => void;
}

export function LicenseRevokeDialog({ licenseId, onRevoke, onClose }: LicenseRevokeDialogProps) {
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      onRevoke(licenseId, reason || undefined);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Ban className="w-5 h-5 text-red-400" />
            Revoke License Key
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This action will immediately invalidate the license key. The user will no longer be able to access premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action cannot be undone. The license key will be permanently invalid.
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
            <Label htmlFor="reason" className="text-foreground">
              Revocation Reason <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="E.g., Payment failure, Terms of service violation, User request..."
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              className="bg-muted border-border text-foreground min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged in the audit trail for compliance purposes.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={revoking}
            className="border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={revoking}
            className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          >
            {revoking ? 'Revoking...' : 'Revoke License'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
