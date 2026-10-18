import type {
  ControlDeckScreenId,
  StitchScreenSpec,
} from '@/seed/types/stitch-control-deck';

export type ViewportPreset = 'full' | 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_WIDTH_CLASS: Record<ViewportPreset, string> = {
  full: 'w-full',
  desktop: 'w-full max-w-[1440px] mx-auto',
  tablet: 'w-full max-w-[768px] mx-auto',
  mobile: 'w-full max-w-[390px] mx-auto',
};

export const FALLBACK_ROUTE_BY_SCREEN: Partial<Record<ControlDeckScreenId, string>> = {
  dashboard: '/dashboard',
  'ask-advisors': '/dashboard/control-deck',
  'video-studio': '/dashboard/missions',
  'billing-revenue': '/dashboard/affiliate',
  'setup-wizard': '/setup-wizard',
  'agency-portal': '/partner',
  'mobile-companion': '/dashboard/approvals',
  pricing: '/pricing',
  'style-guide': '/dashboard/control-deck',
};

export function resolveCleanHtmlFile(spec: StitchScreenSpec): string {
  const raw = spec.htmlFile ?? spec.routeHtml;
  return raw.replace(/^\/+/, '');
}

export function synchronizeStitchIframeDom(params: {
  iframe: HTMLIFrameElement;
  lang: 'en' | 'vi';
  screens: readonly StitchScreenSpec[];
  onSelectScreen: (id: ControlDeckScreenId) => void;
  onMeasureHeight: (height: number) => void;
}): void {
  const { iframe, lang, screens, onSelectScreen, onMeasureHeight } = params;
  try {
    const win = iframe.contentWindow as
      | (Window & { setLang?: (locale: 'en' | 'vi') => void })
      | null;
    const doc = iframe.contentDocument;
    if (!doc) return;

    if (typeof win?.setLang === 'function') {
      win.setLang(lang);
    } else {
      doc.documentElement.lang = lang;
      doc.querySelectorAll<HTMLElement>('[data-en][data-vi]').forEach((el) => {
        const nextText = el.getAttribute(`data-${lang}`);
        if (nextText) el.textContent = nextText;
      });
    }

    const topNav = doc.querySelector('body > nav');
    if (topNav instanceof HTMLElement) {
      topNav.style.display = 'none';
    }

    doc.querySelectorAll<HTMLAnchorElement>('a[href$=".html"]').forEach((anchor) => {
      const rawHref = anchor.getAttribute('href') || '';
      const cleanFile = rawHref.split('/').pop()?.split('?')[0] || '';
      const matched = screens.find((item) => resolveCleanHtmlFile(item) === cleanFile);
      if (matched) {
        anchor.onclick = (event: MouseEvent) => {
          event.preventDefault();
          onSelectScreen(matched.id);
        };
      }
    });

    const measured = doc.body?.scrollHeight || doc.documentElement?.scrollHeight || 860;
    onMeasureHeight(Math.max(780, Math.min(2400, measured + 24)));
  } catch {
    // Graceful fallback during initial iframe load
  }
}
