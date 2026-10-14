/**
 * APAC and Global Jurisdiction Rules (VN, SG, GLOBAL).
 * @module tree/cultural-adaptation/compliance/jurisdiction-apac-rules
 */

import type { JurisdictionRuleDef } from './types';

export const APAC_AND_GLOBAL_JURISDICTION_RULES: Record<
  'VN' | 'SG' | 'GLOBAL',
  JurisdictionRuleDef
> = {
  VN: {
    jurisdiction: 'VN',
    mandatoryLabelEn: 'Content created with Sophia AI',
    mandatoryLabelLocal: 'Nội dung được tạo bằng trí tuệ nhân tạo (Sophia AI)',
    audioDisclaimerEn: 'Voice commentary synthesized with Sophia AI.',
    audioDisclaimerLocal: 'Giọng đọc và nội dung được tạo tự động bằng trí tuệ nhân tạo Sophia AI.',
    defaultPosition: 'bottom_right',
    watermarkRequired: true,
    audioDisclosureRequired: true,
    forbiddenRules: [
      {
        ruleId: 'vn-decree13-ai-persona-disclosure',
        category: 'ai_disclosure',
        regex: /(người\s*thật\s*100%|không\s*phải\s*ai|bác\s*sĩ\s*trực\s*tiếp\s*khám)/gi,
        message: 'Nghị định 13/2023/NĐ-CP & Luật Quảng cáo cấm giả mạo danh tính cá nhân và chuyên gia y tế bằng AI.',
        severity: 'error',
        safeReplacement: 'Trợ lý AI Sophia đại diện',
      },
      {
        ruleId: 'vn-ad-law-cure-all',
        category: 'consumer_protection',
        regex: /(chữa\s*khỏi\s*100%|cam\s*kết\s*dứt\s*điểm|thuốc\s*tiên|trị\s*dứt\s*bệnh\s*tận\s*gốc)/gi,
        message: 'Luật Quảng cáo 2012 nghiêm cấm quảng cáo dược phẩm / thực phẩm chức năng khẳng định chữa khỏi 100%.',
        severity: 'error',
        safeReplacement: 'hỗ trợ cải thiện hiệu quả',
      },
      {
        ruleId: 'vn-ad-law-unconditional-refund',
        category: 'consumer_protection',
        regex: /(hoàn\s*tiền\s*vô\s*điều\s*kiện|lợi\s*nhuận\s*cam\s*kết\s*100%|lãi\s*suất\s*khủng\s*chắc\s*chắn)/gi,
        message: 'Quy định quản lý quảng cáo tài chính nghiêm cấm hứa hẹn lợi nhuận chắc chắn không rủi ro.',
        severity: 'error',
        safeReplacement: 'tiềm năng sinh lời bền vững',
      },
    ],
  },
  SG: {
    jurisdiction: 'SG',
    mandatoryLabelEn: 'AI Synthesized Media (Sophia AI)',
    mandatoryLabelLocal: 'AI Synthesized Media (Sophia AI)',
    audioDisclaimerEn: 'Synthetic audio generated with Sophia AI.',
    audioDisclaimerLocal: 'Synthetic audio generated with Sophia AI.',
    defaultPosition: 'bottom_right',
    watermarkRequired: true,
    audioDisclosureRequired: false,
    forbiddenRules: [
      {
        ruleId: 'sg-cpex-misleading-claims',
        category: 'consumer_protection',
        regex: /\b(guaranteed\s*financial\s*returns|100%\s*risk-free|instant\s*passive\s*income)\b/gi,
        message: 'Singapore Consumer Protection (Fair Trading) Act prohibits deceptive financial promises.',
        severity: 'error',
        safeReplacement: 'transparent investment approach',
      },
    ],
  },
  GLOBAL: {
    jurisdiction: 'GLOBAL',
    mandatoryLabelEn: 'Created with Sophia AI',
    mandatoryLabelLocal: 'Created with Sophia AI',
    audioDisclaimerEn: 'Audio synthesized by Sophia AI.',
    audioDisclaimerLocal: 'Audio synthesized by Sophia AI.',
    defaultPosition: 'bottom_right',
    watermarkRequired: true,
    audioDisclosureRequired: false,
    forbiddenRules: [
      {
        ruleId: 'global-standard-fraudulent-promise',
        category: 'consumer_protection',
        regex: /\b(100%\s*guaranteed|miracle\s*cure|double\s*your\s*money)\b/gi,
        message: 'Global advertising baseline prohibits fraudulent or unverified performance guarantees.',
        severity: 'warning',
        safeReplacement: 'exceptional performance results',
      },
    ],
  },
};
