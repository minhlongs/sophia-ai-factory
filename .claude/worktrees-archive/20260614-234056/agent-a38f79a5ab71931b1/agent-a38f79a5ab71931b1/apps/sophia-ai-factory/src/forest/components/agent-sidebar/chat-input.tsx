/**
 * Chat Input — textarea + send button at bottom of sidebar
 *
 * Submits on Enter (Shift+Enter for newline).
 * Checks MCU credits before sending (shows error if exhausted).
 *
 * @module components/agent-sidebar/chat-input
 */

'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, sending, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations('agentChat');

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    setValue('');
    await onSend(trimmed);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="border-t border-border p-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          disabled={sending || disabled}
          rows={2}
          className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!value.trim() || sending || disabled}
          aria-label="Send"
          className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('sessionNote')}
      </p>
    </div>
  );
}
