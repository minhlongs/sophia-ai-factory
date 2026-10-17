/**
 * Vietnam Holiday Campaign Templates
 *
 * @module land/templates/vietnam-holiday-templates
 */

import type { CampaignTemplate } from './campaign-templates';

export const VIETNAM_HOLIDAY_TEMPLATES: CampaignTemplate[] = [
  {
    id: "tet-lunar-new-year",
    name: "Tết Nguyên Đán / Lunar New Year",
    description: "Chiến dịch Tết với không khí lễ hội, chúc mừng năm mới. / Festive Lunar New Year campaign with Vietnamese celebration themes.",
    category: "seasonal",
    icon: "🎊",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Năm Mới — Happy New Year!",
      audience: "Khách hàng Việt Nam và toàn cầu / Vietnamese and global customers",
      tone: "enthusiastic",
      suggestedDuration: 20,
      keywords: ["tết", "năm mới", "xuân", "chúc mừng", "lunar new year", "spring festival"]
    }
  },
  {
    id: "trung-thu-mid-autumn",
    name: "Tết Trung Thu / Mid-Autumn Festival",
    description: "Chiến dịch gia đình dịp Trung Thu — bánh trung thu, đèn lồng, sum họp. / Family-themed Mid-Autumn campaign with mooncakes and lanterns.",
    category: "seasonal",
    icon: "🥮",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Tết Trung Thu / Happy Mid-Autumn!",
      audience: "Gia đình Việt Nam / Vietnamese families",
      tone: "friendly",
      suggestedDuration: 20,
      keywords: ["trung thu", "bánh trung thu", "đèn lồng", "mid-autumn", "mooncake", "family"]
    }
  },
  {
    id: "quoc-khanh-national-day",
    name: "Quốc Khánh 2/9 / Vietnam National Day",
    description: "Chiến dịch Quốc Khánh 2 tháng 9 — tự hào dân tộc, tinh thần Việt Nam. / Patriotic campaign for Vietnam National Day (September 2).",
    category: "seasonal",
    icon: "🇻🇳",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Quốc Khánh 2/9 — Vietnam National Day",
      audience: "Người Việt Nam trong và ngoài nước / Vietnamese at home and abroad",
      tone: "professional",
      suggestedDuration: 25,
      keywords: ["quốc khánh", "2/9", "độc lập", "việt nam", "national day", "independence"]
    }
  }
];
