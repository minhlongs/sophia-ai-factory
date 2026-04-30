import React from 'react';
import { Check, RefreshCw } from 'lucide-react';

interface FinishStepProps {
  saveError: string | null;
  saveFailed?: boolean;
  onRetry?: () => void;
}

export function FinishStep({ saveError, saveFailed, onRetry }: FinishStepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
      <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
        <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Sẵn Sàng! / Ready!
        </h2>
        <p className="text-muted-foreground mt-2">
          Nhấn nút bên dưới để vào Dashboard. Bạn có thể thêm hoặc thay đổi API key bất cứ lúc nào trong Settings.
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Click the button below to enter your Dashboard. You can add or change API keys anytime in Settings.
        </p>
      </div>

      {saveError && (
        <div className="bg-destructive/10 p-4 rounded-lg text-left">
          <h4 className="font-semibold text-destructive mb-1">Lỗi / Error</h4>
          <p className="text-sm text-destructive">{saveError}</p>
          {saveFailed && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại / Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
