'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export function SophiaAgentChatReplay() {
  const t = useTranslations('stitch.landing');

  return (
    <div data-testid="sophia-agent-chat-replay">
      <div className="cmd-line">
        <span className="prompt">$</span>
        <code>{t('v3Core.chatCommand')}</code>
      </div>

      <div className="chat" role="region" aria-label={t('v3Core.chatHeader')}>
        <div className="chat-hd">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="chat-ttl">{t('v3Core.chatHeader')}</span>
        </div>

        <div className="msg">
          <span className="who">YOU</span>
          <p>{t('v3Core.chatYou1')}</p>
        </div>

        <div className="msg agent">
          <span className="who">SOPHIA</span>
          <p>{t('v3Core.chatSophia1')}</p>
        </div>

        <div className="msg">
          <span className="who">YOU</span>
          <p>{t('v3Core.chatYou2')}</p>
        </div>

        <div className="msg agent">
          <span className="who">SOPHIA</span>
          <p>
            <span className="ok" aria-hidden="true">
              ✓
            </span>
            {t('v3Core.chatSophia2')}
          </p>
        </div>
      </div>
    </div>
  );
}
