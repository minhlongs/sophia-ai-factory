'use client';

export type HelpData = {
  sections?: Array<{
    id: string;
    icon: string;
    title: string;
    intro: string;
    steps: Array<{ title: string; desc: string; link?: string; linkLabel?: string }>;
    tip?: string;
  }>;
  issues?: Array<{
    severity: 'high' | 'medium' | 'low';
    symptom: string;
    cause: string;
    steps: string[];
    followUp?: { href: string; label: string };
  }>;
  sections_faq?: Array<{
    heading: string;
    items: Array<{ q: string; a: string; link?: { href: string; label: string } }>;
  }>;
};

export interface HelpPageProps {
  locale: string;
  data: HelpData;
  pageTitle: string;
  pageSubtitle: string;
  type: 'sops' | 'troubleshooting' | 'faq';
}
