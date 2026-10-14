import React from 'react';
import { Loader2 } from 'lucide-react';

interface ActionBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  busy: boolean;
}

export function ActionBtn({ icon: Icon, label, onClick, busy }: ActionBtnProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 ${
        label === 'Regenerate'
          ? 'text-amber-500 hover:text-amber-400'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  );
}
