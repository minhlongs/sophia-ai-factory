/**
 * Chat Message List — scrollable messages area
 *
 * Renders user and assistant messages.
 * Assistant messages can include ShowWorkPanel for reasoning.
 *
 * @module components/agent-sidebar/chat-message-list
 */

'use client';

import { useEffect, useRef } from 'react';
import { ShowWorkPanel } from './show-work-panel';
import type { ChatMessage } from '@/land/agent-chat/types';

interface ChatMessageListProps {
  messages: ChatMessage[];
  sending: boolean;
}

export function ChatMessageList({ messages, sending }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-4 text-center">
        <span>{'⌘K to search • Ask Sophia anything...'}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div
            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {msg.content || (msg.role === 'assistant' && sending ? '…' : '')}
          </div>
          {msg.role === 'assistant' && msg.reasoning && (
            <div className="w-full mt-0.5">
              <ShowWorkPanel reasoning={msg.reasoning} />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
