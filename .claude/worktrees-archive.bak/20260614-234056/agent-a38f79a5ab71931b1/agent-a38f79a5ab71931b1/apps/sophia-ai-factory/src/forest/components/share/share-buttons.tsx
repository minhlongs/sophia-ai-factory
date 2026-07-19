'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  text?: string;
  className?: string;
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ' +
  'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white ' +
  'transition-colors duration-150 cursor-pointer select-none';

export function ShareButtons({ url, title, text, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function openShare(shareUrl: string) {
    window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
  }

  const encoded = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text || title);

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {/* Copy Link */}
      <button type="button" onClick={copyLink} className={BUTTON_CLASS} aria-label="Copy link">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      {/* Twitter/X */}
      <button
        type="button"
        onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`)}
        className={BUTTON_CLASS}
        aria-label="Share on X (Twitter)"
      >
        <span className="text-sm leading-none font-bold">𝕏</span>
        Post
      </button>

      {/* Facebook */}
      <button
        type="button"
        onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`)}
        className={BUTTON_CLASS}
        aria-label="Share on Facebook"
      >
        {/* Facebook "f" icon via SVG */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
        Facebook
      </button>

      {/* LinkedIn */}
      <button
        type="button"
        onClick={() =>
          openShare(
            `https://www.linkedin.com/shareArticle?mini=true&url=${encoded}&title=${encodeURIComponent(title)}`
          )
        }
        className={BUTTON_CLASS}
        aria-label="Share on LinkedIn"
      >
        {/* LinkedIn icon via SVG */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
        LinkedIn
      </button>

      {/* Telegram */}
      <button
        type="button"
        onClick={() => openShare(`https://t.me/share/url?url=${encoded}&text=${encodedText}`)}
        className={BUTTON_CLASS}
        aria-label="Share on Telegram"
      >
        <Share2 className="w-3.5 h-3.5" />
        Telegram
      </button>
    </div>
  );
}
