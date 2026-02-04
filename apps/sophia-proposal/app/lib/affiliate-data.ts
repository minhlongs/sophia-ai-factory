import { LucideIcon, Database, Layout, FileText, Mail, Video, Zap, MessageSquare, Briefcase, Calendar } from 'lucide-react';

export interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  commission: string;
  description: string;
  link: string;
  icon?: string; // Placeholder for icon mapping key if needed
  color: 'cyan' | 'purple' | 'pink'; // For neon accent
}

export const affiliatePrograms: AffiliateProgram[] = [
  // High Tier (40-50%)
  {
    id: 'smartsuite',
    name: 'SmartSuite',
    category: 'Work Management',
    commission: '50%',
    description: 'Collaborative Work Management Platform',
    link: '#',
    color: 'cyan'
  },
  {
    id: 'glide',
    name: 'Glide',
    category: 'No-Code Builder',
    commission: '50%',
    description: 'Build apps from Google Sheets & Excel',
    link: '#',
    color: 'cyan'
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    commission: '40%',
    description: 'All-in-one workspace for notes & docs',
    link: '#',
    color: 'cyan'
  },
  // Mid Tier (25-35%)
  {
    id: 'pandadoc',
    name: 'PandaDoc',
    category: 'Sales Automation',
    commission: '25-45%',
    description: 'Document automation software',
    link: '#',
    color: 'purple'
  },
  {
    id: 'make',
    name: 'Make',
    category: 'Automation',
    commission: '30%',
    description: 'Visual automation platform',
    link: '#',
    color: 'purple'
  },
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'Web Design',
    commission: '30%',
    description: 'Visual web design tool',
    link: '#',
    color: 'purple'
  },
  {
    id: 'jasper',
    name: 'Jasper',
    category: 'AI Writing',
    commission: '30%',
    description: 'AI content generator',
    link: '#',
    color: 'purple'
  },
  {
    id: 'monday',
    name: 'Monday.com',
    category: 'Project Management',
    commission: '25%',
    description: 'Work OS platform',
    link: '#',
    color: 'purple'
  },
  {
    id: 'surveysparrow',
    name: 'SurveySparrow',
    category: 'Customer Experience',
    commission: '25%',
    description: 'Omnichannel experience management',
    link: '#',
    color: 'purple'
  },
  // Standard Tier (15-20%)
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Database',
    commission: '20%',
    description: 'Low-code platform for building apps',
    link: '#',
    color: 'pink'
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    category: 'Project Management',
    commission: '20%',
    description: 'One app to replace them all',
    link: '#',
    color: 'pink'
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'Automation',
    commission: '20%',
    description: 'Connect your apps and automate workflows',
    link: '#',
    color: 'pink'
  },
  {
    id: 'livestorm',
    name: 'Livestorm',
    category: 'Video Conferencing',
    commission: '20%',
    description: 'Video engagement platform',
    link: '#',
    color: 'pink'
  },
  {
    id: 'typeform',
    name: 'Typeform',
    category: 'Forms & Surveys',
    commission: '20%',
    description: 'People-friendly forms and surveys',
    link: '#',
    color: 'pink'
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    category: 'Customer Support',
    commission: '20%',
    description: 'Customer service software',
    link: '#',
    color: 'pink'
  },
  {
    id: 'apollo',
    name: 'Apollo',
    category: 'Sales Intelligence',
    commission: '15-20%',
    description: 'Sales intelligence and engagement platform',
    link: '#',
    color: 'pink'
  },
  {
    id: 'instapage',
    name: 'Instapage',
    category: 'Marketing',
    commission: '15%',
    description: 'Landing page builder',
    link: '#',
    color: 'pink'
  },
  {
    id: 'loom',
    name: 'Loom',
    category: 'Video Messaging',
    commission: '15%',
    description: 'Video messaging for work',
    link: '#',
    color: 'pink'
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'Scheduling',
    commission: '15%',
    description: 'Scheduling automation platform',
    link: '#',
    color: 'pink'
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'Customer Messaging',
    commission: '15%',
    description: 'Customer messaging platform',
    link: '#',
    color: 'pink'
  }
];
