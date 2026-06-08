/**
 * Agent Sidebar — right-rail collapsible chat panel
 *
 * Persists expanded/collapsed state in localStorage key: sophia.sidebar.expanded
 * Chat session is client-side only (sessionStorage-like behavior via React state).
 *
 * @module components/agent-sidebar/agent-sidebar
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { SidebarToggle } from './sidebar-toggle';
import { useAgentChat } from './use-agent-chat';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'sophia.sidebar.expanded';

export function AgentSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('agentChat');
  const pathname = usePathname();
  const { messages, sending, error, sendMessage, clearMessages } = useAgentChat();

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        setTimeout(() => setExpanded(true), 0);
      }
    } catch {
      // SSR / private mode
    }
    setTimeout(() => setMounted(true), 0);
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleSend = useCallback(
    (content: string) => sendMessage(content, pathname),
    [sendMessage, pathname],
  );

  // Don't render mismatched state during SSR
  if (!mounted) return null;

  if (!expanded) {
    return <SidebarToggle onClick={toggle} />;
  }

  return (
    <aside
      className="fixed right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-background/60 backdrop-blur-xl shadow-2xl transition-all"
      aria-label={t('title')}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t('title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">⌘K</span>
          <button
            onClick={clearMessages}
            aria-label={t('newChat')}
            title={t('newChat')}
            className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded hover:bg-muted/30 hover:scale-105 active:scale-95 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggle}
            aria-label={t('collapse')}
            title={t('collapse')}
            className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded hover:bg-muted/30 hover:scale-105 active:scale-95 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatMessageList messages={messages} sending={sending} />

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} sending={sending} />
    </aside>
  );
}
