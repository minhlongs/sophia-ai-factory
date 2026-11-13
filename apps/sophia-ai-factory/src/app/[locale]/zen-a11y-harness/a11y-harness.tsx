'use client';

/**
 * Dialog accessibility harness — development only (see page.tsx).
 *
 * Renders three dialogs from the product, each openable by a real interaction:
 *   1. `HarnessFormDialog` — the shared Dialog wrapper with a real DialogTrigger.
 *   2. `ByokRotationView`   — the production rotation console and its dialog.
 *   3. `CmdKPalette`        — the production palette, opened with Cmd+K.
 *
 * Nothing here is imported by product code; it exists so Playwright can drive
 * the shipping components rather than a stand-in.
 *
 * @module app/[locale]/__zen-a11y-harness/a11y-harness
 */

import * as React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { ByokRotationView } from '@/app/(app)/dashboard/admin/byok-rotation/components/byok-rotation-view';
import { CmdKPalette } from '@/forest/components/cmd-k/cmd-k-palette';

interface A11yHarnessProps {
  locale: string;
}

function HarnessFormDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" data-testid="harness-dialog-trigger">
          Open form dialog
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="harness-dialog-content">
        <DialogHeader>
          <DialogTitle>Harness dialog title</DialogTitle>
          <DialogDescription>
            A modal used to verify focus placement, keyboard containment and
            screen reader semantics.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label htmlFor="harness-field-first" className="text-sm font-medium text-foreground">
            First field
          </label>
          <Input id="harness-field-first" data-testid="harness-field-first" />
          <label htmlFor="harness-field-second" className="text-sm font-medium text-foreground">
            Second field
          </label>
          <Input id="harness-field-second" data-testid="harness-field-second" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" data-testid="harness-dialog-cancel">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="default" data-testid="harness-dialog-confirm">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function A11yHarness({ locale }: A11yHarnessProps) {
  const [reason, setReason] = React.useState('');

  return (
    <main className="min-h-screen bg-background py-16 px-4" data-testid="a11y-harness">
      <div className="max-w-6xl mx-auto space-y-12">
        <header>
          <h1 className="text-3xl font-bold text-foreground">Dialog accessibility harness</h1>
          <p className="text-muted-foreground mt-2">
            Development only. Mounts the product dialogs for keyboard and screen
            reader verification.
          </p>
          <div className="mt-4">
            <HarnessFormDialog />
          </div>
        </header>

        <section aria-label="Rotation dialog host">
          <ByokRotationView
            locale={locale}
            currentVersion={null}
            versionHistory={[]}
            auditLogs={[]}
          />
        </section>
      </div>
      <CmdKPalette isAdmin />
    </main>
  );
}
