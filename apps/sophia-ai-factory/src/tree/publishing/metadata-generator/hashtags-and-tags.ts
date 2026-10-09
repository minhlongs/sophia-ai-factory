/**
 * @file hashtags-and-tags.ts
 * @description Multilingual trending hashtags and platform signature tags.
 * @layer tree
 */

import type { ApacLanguage, PlatformType } from '@/seed/types/apac-syndication';

export const NICHE_HASHTAGS_BY_LANGUAGE: Record<ApacLanguage, Record<string, string[]>> = {
  vi: {
    ai_automation: ['#CongNgheAI', '#TuDongHoa', '#TriTueNhanTao', '#KinhDoanhOnline', '#KhoiNghiepAI'],
    ecommerce: ['#KinhDoanhOnline', '#ThuongMaiDienTu', '#BanHangOnline', '#ShopOnline', '#TikTokShop'],
    solopreneur: ['#SoloFounder', '#KinhDoanhTuDo', '#KiemTienOnline', '#TuDoTaiChinh', '#HocLamGiau'],
    default: ['#SophiaAI', '#XuHuong', '#KienThucMoi', '#CongNgheMoi', '#PhatTrienBanThan'],
  },
  en: {
    ai_automation: ['#AIAutomation', '#ArtificialIntelligence', '#TechTrends', '#ProductivityHacks', '#WorkflowAutomation'],
    ecommerce: ['#EcommerceTips', '#ShopifySuccess', '#OnlineBusiness', '#DropShipping', '#TikTokMadeMeBuyIt'],
    solopreneur: ['#Solopreneur', '#SideHustle', '#CreatorEconomy', '#PassiveIncome', '#StartupLife'],
    default: ['#SophiaAIFactory', '#TechInnovation', '#LearnOnTikTok', '#LifeHacks', '#ViralVideo'],
  },
  ja: {
    ai_automation: ['#AIツール', '#業務効率化', '#ChatGPT活用', '#自動化', '#最新テクノロジー'],
    ecommerce: ['#ネットショップ', '#ECビジネス', '#物販ビジネス', '#D2C', '#売上アップ'],
    solopreneur: ['#ひとり起業', '#副業初心者', '#不労所得', '#在宅ワーク', '#フリーランス'],
    default: ['#SophiaAI', '#ビジネス', '#自己啓発', '#仕事術', '#トレンド'],
  },
  ko: {
    ai_automation: ['#AI자동화', '#인공지능툴', '#스마트워크', '#생산성향상', '#테크트렌드'],
    ecommerce: ['#이커머스', '#온라인쇼핑몰', '#스마트스토어', '#매출상승', '#디지털노마드'],
    solopreneur: ['#1인기업', '#부업추천', '#수익창출', '#경제적자유', '#자기계발'],
    default: ['#SophiaAI', '#쇼츠추천', '#비즈니스팁', '#꿀팁공유', '#핫이슈'],
  },
  th: {
    ai_automation: ['#ปัญญาประดิษฐ์', '#ระบบอัตโนมัติ', '#เทคโนโลยีใหม่', '#เพิ่มยอดขาย', '#เครื่องมือAI'],
    ecommerce: ['#ขายของออนไลน์', '#ธุรกิจออนไลน์', '#เปิดร้านออนไลน์', '#การตลาดออนไลน์', '#TikTokShopครีเอเตอร์'],
    solopreneur: ['#สร้างรายได้ออนไลน์', '#อาชีพอิสระ', '#หารายได้เสริม', '#ฟรีแลนซ์', '#อิสรภาพทางการเงิน'],
    default: ['#SophiaAI', '#คลิปไวรัล', '#ความรู้ดีๆ', '#ฮาวทู', '#เทรนด์วันนี้'],
  },
};

export const PLATFORM_SIGNATURE_TAGS: Record<PlatformType, string[]> = {
  youtube_shorts: ['#Shorts', '#YouTubeShorts'],
  tiktok: ['#FYP', '#ViralVideo', '#ForYou'],
  instagram_reels: ['#ReelsInstagram', '#ReelsViral', '#InstaReels'],
  facebook_reels: ['#FBReels', '#ReelsFacebook', '#VideoTrending'],
};
