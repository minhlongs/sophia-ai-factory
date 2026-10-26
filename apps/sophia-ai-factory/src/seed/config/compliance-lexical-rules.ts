/**
 * @module seed/config/compliance-lexical-rules
 * Prohibited financial & promotional claim patterns per FTC 16 C.F.R. § 255,
 * CFTC Rule 4.41, and EU MiCA Regulation (EU 2023/1114) Art. 7 & 53.
 */

export interface LexicalRuleViolation {
  ruleId: string;
  matchedPhrase: string;
  regulatoryBasis: string;
  safeReplacementEn: string;
  safeReplacementVi: string;
}

export interface LexicalComplianceRule {
  ruleId: string;
  pattern: RegExp;
  regulatoryBasis: string;
  safeReplacementEn: string;
  safeReplacementVi: string;
}

export const PROHIBITED_LEXICAL_RULES: readonly LexicalComplianceRule[] = [
  {
    ruleId: 'GUARANTEED_PROFIT_CLAIM',
    pattern: /\b(guaranteed\s+profit|guaranteed\s+returns?|cam\s+kết\s+lợi\s+nhuận|lãi\s+chắc\s+chắn\s+100%)\b/i,
    regulatoryBasis: 'FTC 16 C.F.R. § 255 / CFTC Rule 4.41',
    safeReplacementEn: 'historical performance metrics (not a guarantee of future results)',
    safeReplacementVi: 'số liệu hiệu suất lịch sử (không cam kết lợi nhuận tương lai)',
  },
  {
    ruleId: 'ZERO_RISK_CLAIM',
    pattern: /\b(risk[-\s]?free\s+(?:return|trading|profit)|zero\s+risk\s+crypto|không\s+rủi\s+ro|an\s+toàn\s+tuyệt\s+đối\s+100%)\b/i,
    regulatoryBasis: 'EU MiCA Art. 7 (Fair, clear and not misleading information)',
    safeReplacementEn: 'risk-managed strategy (digital assets carry high volatility risk)',
    safeReplacementVi: 'chiến lược quản trị rủi ro (tài sản số có biến động cao)',
  },
  {
    ruleId: 'UNREALISTIC_WIN_RATE_CLAIM',
    pattern: /\b(100%\s+win\s*rate|never\s+lose\s+a\s+trade|thắng\s+100%|bất\s+bại\s+mọi\s+lệnh)\b/i,
    regulatoryBasis: 'CFTC Rule 4.41 Hypothetical Performance',
    safeReplacementEn: 'backtested strategy with documented risk parameters',
    safeReplacementVi: 'chiến lược đã kiểm thử backtest với thông số rủi ro minh bạch',
  },
  {
    ruleId: 'EXTREME_MULTIPLIER_PROMISE',
    pattern: /\b(guaranteed\s+100x|easy\s+100x\s+tonight|chắc\s+chắn\s+x100\s+tài\s+khoản)\b/i,
    regulatoryBasis: 'FTC Deceptive Earnings Claims Guide',
    safeReplacementEn: 'asymmetric market opportunity with high capital risk',
    safeReplacementVi: 'cơ hội thị trường biên độ lớn đi kèm rủi ro vốn cao',
  },
];
