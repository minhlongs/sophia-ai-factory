'use client';

/**
 * License Regenerate Dialog Component
 * State/API logic in use-license-regenerate.ts
 */

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import { Badge } from '@/seed/components/ui/badge';
import { Key, RefreshCw, AlertTriangle, Copy, Check, ShieldAlert } from 'lucide-react';
import { LicenseSummary } from '@/forest/raas-schema';
import { useLicenseRegenerate, RegenerateCallbackData } from './use-license-regenerate';

interface LicenseRegenerateDialogProps {
  licenseId?: string;
  onRegenerate?: (data: RegenerateCallbackData) => void;
}

export function LicenseRegenerateDialog({ licenseId: propLicenseId, onRegenerate }: LicenseRegenerateDialogProps) {
  const {
    open, licenseId, setLicenseId, loading, result, copied,
    handleRegenerate, handleCopy, handleOpenChange,
  } = useLicenseRegenerate(propLicenseId, onRegenerate);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-border hover:bg-muted">
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
          Regenerate
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Key className="w-5 h-5 text-[var(--neon-cyan)]" aria-hidden="true" />
            Regenerate License Key
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tạo license key mới thay thế key cũ. Key cũ sẽ ngừng hoạt động ngay lập tức.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            <AlertDescription>
              <strong>⚠️ Cảnh báo quan trọng:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• License cũ sẽ mất hiệu lực ngay khi regenerate</li>
                <li>• Migrated licenses sẽ lose original key format</li>
                <li>• Chỉ hiển thị new key <strong>MỘT LẦN DUY NHẤT</strong></li>
                <li>• Sao lưu new key ngay sau khi tạo</li>
              </ul>
            </AlertDescription>
          </Alert>

          {!propLicenseId && (
            <div>
              <Label className="text-foreground">License ID</Label>
              <Input
                placeholder="Enter license ID (nonce)..."
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value)}
                className="bg-muted border-border text-foreground font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">ID của license cần regenerate</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.newKey ? (
                <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
                  <Check className="w-5 h-5" aria-hidden="true" />
                  <AlertDescription><strong>✅ License Regenerated Successfully!</strong></AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  <AlertDescription>{result.warning}</AlertDescription>
                </Alert>
              )}

              {result.newKey && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                      Copy New Key Immediately!
                    </Label>
                    <Button variant="outline" size="sm" onClick={handleCopy} className="border-border hover:bg-muted">
                      {copied ? <Check className="w-4 h-4 text-green-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                    </Button>
                  </div>
                  <div className="p-3 bg-muted border border-border rounded-lg break-all font-mono text-xs text-foreground">
                    {result.newKey}
                  </div>
                </div>
              )}

              {result.newLicense && <NewLicenseInfo license={result.newLicense} />}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-border hover:bg-muted">Close</Button>
          </DialogClose>
          <Button
            onClick={handleRegenerate}
            disabled={loading || !licenseId.trim()}
            className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white font-semibold"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 mr-2 motion-safe:animate-spin" aria-hidden="true" />Regenerating…</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Regenerate Key</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLicenseInfo({ license }: { license: LicenseSummary }) {
  const tierClass = {
    master: 'bg-red-500/10 text-red-400 border-red-500/30',
    enterprise: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    premium: 'bg-primary/50/10 text-primary border-primary/50/30',
    basic: 'bg-primary/10/10 text-primary border-primary/30/30',
  }[(license.tier as string).toLowerCase()] ?? '';

  return (
    <div className="p-3 bg-muted border border-border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">New License ID:</span>
        <code className="text-xs text-[var(--neon-cyan)] font-mono">{license.id}</code>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Tier:</span>
        <Badge className={tierClass} variant="outline">{license.tier}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Created:</span>
        <span className="text-xs text-foreground">{new Date(license.createdAt * 1000).toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Expires:</span>
        <span className="text-xs text-foreground">
          {license.expiresAt === 0 || license.expiresAt === null
            ? 'Perpetual'
            : new Date(license.expiresAt * 1000).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
