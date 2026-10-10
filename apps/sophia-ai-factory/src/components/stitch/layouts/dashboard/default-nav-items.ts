import {
  LayoutDashboard,
  PlusCircle,
  Film,
  Wand2,
  Youtube,
  BookOpen,
  Share2,
  ShoppingBag,
  ShieldCheck,
  Terminal,
  Activity,
} from 'lucide-react';
import type { SidebarItem } from '../../ui/sidebar';

export function getDefaultNavItems(t: (key: string) => string): SidebarItem[] {
  return [
    { id: 'dashboard', label: t('overview'), icon: LayoutDashboard, href: '/dashboard' },
    { id: 'create_mission', label: t('createMission'), icon: PlusCircle, href: '/dashboard/missions/new' },
    { id: 'missions', label: t('aiMissions'), icon: Film, href: '/dashboard/missions' },
    { id: 'creative_studio', label: t('creativeStudio'), icon: Wand2, href: '/dashboard/creative-economy' },
    { id: 'youtube', label: t('youtubeAutomation'), icon: Youtube, href: '/dashboard/youtube' },
    { id: 'playbooks', label: t('playbooks'), icon: BookOpen, href: '/dashboard/playbooks' },
    { id: 'publish_queue', label: t('distributionQueue'), icon: Share2, href: '/dashboard/publish/queue' },
    { id: 'marketplace', label: t('creatorMarketplace'), icon: ShoppingBag, href: '/marketplace' },
    { id: 'handover', label: t('handoverAcceptance'), icon: ShieldCheck, href: '/dashboard/handover' },
    { id: 'runbooks', label: t('runbooks'), icon: Terminal, href: '/dashboard/docs/runbooks' },
    { id: 'system_health', label: t('systemHealth'), icon: Activity, href: '/dashboard/system-health' },
  ];
}
