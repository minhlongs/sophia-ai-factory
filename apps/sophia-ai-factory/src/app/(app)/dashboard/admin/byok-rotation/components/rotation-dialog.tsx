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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
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
