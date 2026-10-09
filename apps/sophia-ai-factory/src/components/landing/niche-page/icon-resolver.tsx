import React from 'react';
import { Zap, Film, BarChart3, Globe, Play, ArrowRight, CheckCircle } from 'lucide-react';

/**
 * Niche Landing Icon Resolver
 *
 * Maps category/icon name to corresponding Lucide icon component.
 *
 * @module components/landing/niche-page/icon-resolver
 */

const iconCategory: Record<string, string> = {
  home: 'film', 'shopping-cart': 'play', smartphone: 'play', repeat: 'arrow',
  'trending-up': 'chart', users: 'chart', 'bar-chart': 'chart', compare: 'chart',
  coins: 'zap', rocket: 'zap', dumbbell: 'zap', utensils: 'zap', 'chef-hat': 'zap',
  sparkles: 'zap', swords: 'zap',
  'message-circle': 'check', shield: 'check', heart: 'check', apple: 'check',
  brain: 'check', award: 'check', star: 'check', target: 'check', calendar: 'check',
  scale: 'check', briefcase: 'check', umbrella: 'check', 'shield-check': 'check',
  smile: 'check', wrench: 'check', 'thumbs-up': 'check', shirt: 'check', trophy: 'check',
  bookmark: 'check',
  'map-pin': 'globe', languages: 'globe', map: 'globe', compass: 'globe', globe: 'globe',
  'book-open': 'play', presentation: 'play', 'play-circle': 'play', 'file-text': 'play',
  camera: 'play', 'shopping-bag': 'play', gamepad: 'play', twitch: 'play',
  music: 'play', mic: 'play', disc: 'play', headphones: 'play', edit: 'play', video: 'play',
  truck: 'arrow', 'phone-call': 'arrow', car: 'arrow',
};

export function resolveNicheIcon(iconName: string): React.ReactNode {
  const cat = iconCategory[iconName] ?? iconName;
  switch (cat) {
    case 'film':
      return <Film className="h-8 w-8" />;
    case 'chart':
      return <BarChart3 className="h-8 w-8" />;
    case 'globe':
      return <Globe className="h-8 w-8" />;
    case 'play':
      return <Play className="h-8 w-8" />;
    case 'arrow':
      return <ArrowRight className="h-8 w-8" />;
    case 'check':
      return <CheckCircle className="h-8 w-8" />;
    case 'zap':
    default:
      return <Zap className="h-8 w-8" />;
  }
}
