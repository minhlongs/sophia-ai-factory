// i18n-namespace: stitch.navigation
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
  Megaphone,
  Target,
  DollarSign,
  Image as ImageIcon,
} from 'lucide-react';
import type { SidebarItem } from '../../ui/sidebar';

export function getDefaultNavItems(t: (key: string) => string): SidebarItem[] {
  return [
    { id: 'dashboard', label: t('overview'), icon: LayoutDashboard, href: '/dashboard' },
    { id: 'create_mission', label: t('createMission'), icon: PlusCircle, href: '/dashboard/missions/new' },
    { id: 'missions', label: t('aiMissions'), icon: Film, href: '/dashboard/missions' },
    { id: 'campaigns', label: t('campaigns'), icon: Megaphone, href: '/dashboard/campaigns' },
    { id: 'niche_studio', label: t('nicheStudio'), icon: Wand2, href: '/dashboard/niche-studio' },
    { id: 'creative_studio', label: t('creativeStudio'), icon: Wand2, href: '/dashboard/creative-economy' },
    { id: 'image_studio', label: t('imageStudio'), icon: ImageIcon, href: '/dashboard/image-studio' },
    { id: 'youtube', label: t('youtubeAutomation'), icon: Youtube, href: '/dashboard/youtube' },
    { id: 'affiliates', label: t('affiliates'), icon: DollarSign, href: '/dashboard/affiliates' },
    { id: 'approvals', label: t('approvals'), icon: ShieldCheck, href: '/dashboard/approvals' },
    { id: 'playbooks', label: t('playbooks'), icon: BookOpen, href: '/dashboard/playbooks' },
    { id: 'publish_queue', label: t('distributionQueue'), icon: Share2, href: '/dashboard/publish/queue' },
    { id: 'marketplace', label: t('creatorMarketplace'), icon: ShoppingBag, href: '/marketplace' },
    { id: 'my_sops', label: t('mySops'), icon: BookOpen, href: '/dashboard/sops' },
    { id: 'challenges', label: t('challenges'), icon: Target, href: '/dashboard/challenges' },
    { id: 'handover', label: t('handoverAcceptance'), icon: ShieldCheck, href: '/dashboard/handover' },
    { id: 'runbooks', label: t('runbooks'), icon: Terminal, href: '/dashboard/docs/runbooks' },
    { id: 'system_health', label: t('systemHealth'), icon: Activity, href: '/dashboard/system-health' },
  ];
}
