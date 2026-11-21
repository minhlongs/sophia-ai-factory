import type { Metadata } from 'next';
import { DesignShowcasePage } from '@/components/design-showcase/design-showcase-page';

export const dynamic = 'force-dynamic';

const PAGE_METADATA: Record<string, Metadata> = {
  vi: {
    title: 'Zen Design OS v1.0 — Hệ thống Thiết kế & DTCG Tokens | Sophia AI Factory',
    description:
      'Khám phá hệ thống màu sắc hai chủ đề, kiểm định tương phản WCAG 2.2 AA, thư viện component tương tác và xuất DTCG JSON 2025.10 của Sophia AI Factory.',
  },
  en: {
    title: 'Zen Design OS v1.0 — Design System & DTCG Tokens | Sophia AI Factory',
    description:
      'Explore Sophia AI Factory dual-theme tokens, live WCAG 2.2 AA contrast audit, interactive UI component playground, and W3C DTCG 2025.10 JSON export.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA[locale] ?? PAGE_METADATA.en;
}

export default function DesignRoute() {
  return <DesignShowcasePage />;
}
