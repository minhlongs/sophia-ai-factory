import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';

interface RotationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isRotating: boolean;
}

export function RotationDialog({
  isOpen,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
  isRotating,
}: RotationDialogProps) {
  const t = useTranslations('admin.keyRotation');
  // This dialog is opened by parent state rather than a DialogTrigger, so Radix
  // has no trigger element to return focus to and would drop focus onto <body>.
  // Capture the element that held focus just before the dialog opened and
  // restore it on close, so keyboard users resume where they left off.
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => {
          openerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          openerRef.current = null;
          if (opener && opener.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label htmlFor="rotation-reason" className="text-sm font-medium text-foreground">
            {t('reasonLabel')}
          </label>
          <Input
            id="rotation-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            maxLength={500}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onReasonChange('');
            }}
            disabled={isRotating}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isRotating}
          >
            {isRotating ? t('rotating') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
