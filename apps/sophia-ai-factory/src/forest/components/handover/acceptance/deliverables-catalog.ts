/**
 * Acceptance Client Submodule: Deliverables Catalog.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/deliverables-catalog
 */

import {
  Server,
  Database,
  HardDrive,
  Lock,
  Bot,
  Video,
  BookOpen,
  CreditCard,
  Wallet,
  Shield,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { DeliverableItem } from './types';

export const DELIVERABLES_CATALOG: DeliverableItem[] = [
  { id: 'edge', titleKey: 'edgeRuntime', category: 'infra', icon: Server },
  { id: 'd1', titleKey: 'database', category: 'infra', icon: Database },
  { id: 'r2-media', titleKey: 'mediaVault', category: 'infra', icon: HardDrive },
  { id: 'r2-backups', titleKey: 'backupsVault', category: 'infra', icon: HardDrive },
  { id: 'byok', titleKey: 'byokVault', category: 'security', icon: Lock },
  { id: 'telegram', titleKey: 'telegramBot', category: 'ai', icon: Bot },
  { id: 'creative', titleKey: 'creativeEngine', category: 'ai', icon: Video },
  { id: 'runbooks', titleKey: 'runbooks', category: 'governance', icon: BookOpen },
  { id: 'nowpayments', titleKey: 'nowpayments', category: 'billing', icon: Wallet },
  { id: 'payos', titleKey: 'payos', category: 'billing', icon: CreditCard },
  { id: 'auth', titleKey: 'betterAuth', category: 'security', icon: Shield },
  { id: 'telemetry', titleKey: 'observability', category: 'infra', icon: Activity },
  { id: 'sentry', titleKey: 'sentry', category: 'infra', icon: Activity },
  { id: 'dr', titleKey: 'drAutomation', category: 'infra', icon: Layers },
  { id: 'branding', titleKey: 'whiteLabel', category: 'governance', icon: Sparkles },
];
