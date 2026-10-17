/**
 * Automated Test Suite for Bilingual NL /ask Router & 4-Advisor Consultation
 *
 * Verifies:
 * 1. VI-first and EN keyword routing across all 10 canonical intent categories
 * 2. fnmatch wildcard matching semantics (*suffix, prefix*, *contains*, exact)
 * 3. Vietnamese-first matching priority over English
 * 4. Unknown-command syntax rejection with bilingual error reporting
 * 5. Backward-compatible fallback to 4-Advisor architectural consultation
 * 6. Bilingual (VI + EN) output formatting across all paths
 *
 * @module tree/ask/__tests__/ask-router.test
 */

import { describe, it, expect } from 'vitest';
import {
  routeAsk,
  matchesWildcard,
  generateArchitecturalConsultation,
  CANONICAL_INTENT_CATEGORIES,
  RECOGNIZED_COMMANDS,
} from '../ask-router';

describe('Bilingual /ask Natural Language Router', () => {
  describe('Canonical Category Integrity', () => {
    it('defines exactly 10 canonical intent categories', () => {
      expect(CANONICAL_INTENT_CATEGORIES).toHaveLength(10);
      const expectedTargets = [
        '/cook',
        '/fix',
        '/test',
        '/plan',
        '/brainstorm',
        'deploy',
        '/docs',
        'analytics-report',
        '/security-scan',
        '/audit-compliance',
      ];
      const actualTargets = CANONICAL_INTENT_CATEGORIES.map((c) => c.targetCommand);
      expect(actualTargets).toEqual(expectedTargets);
    });

    it('each category contains both Vietnamese and English keywords', () => {
      for (const cat of CANONICAL_INTENT_CATEGORIES) {
        expect(cat.keywordsVi.length).toBeGreaterThan(0);
        expect(cat.keywordsEn.length).toBeGreaterThan(0);
        expect(cat.nameVi).toBeTruthy();
        expect(cat.nameEn).toBeTruthy();
      }
    });
  });

  describe('Wildcard Semantics (matchesWildcard)', () => {
    it('matches exact case-insensitive strings', () => {
      expect(matchesWildcard('code', 'Tôi muốn viết code hôm nay')).toBe(true);
      expect(matchesWildcard('CODE', 'viết code mới')).toBe(true);
      expect(matchesWildcard('debug', 'please DEBUG this endpoint')).toBe(true);
    });

    it('handles *contains* double-ended wildcards', () => {
      expect(matchesWildcard('*landing page*', 'tạo landing page cho sản phẩm')).toBe(true);
      expect(matchesWildcard('*bảo mật*', 'kiểm tra hệ thống bảo mật')).toBe(true);
      expect(matchesWildcard('*nonexistent*', 'tạo trang web')).toBe(false);
    });

    it('handles *suffix prefix wildcards', () => {
      expect(matchesWildcard('*test', 'chạy test')).toBe(true);
      expect(matchesWildcard('*lỗi', 'tìm ra lỗi')).toBe(true);
      expect(matchesWildcard('*test', 'testing things')).toBe(false);
    });

    it('handles prefix* suffix wildcards', () => {
      expect(matchesWildcard('tạo*', 'tạo mới dự án')).toBe(true);
      expect(matchesWildcard('deploy*', 'deployment to production')).toBe(true);
      expect(matchesWildcard('deploy*', 'auto deploy')).toBe(false);
    });

    it('returns false for empty pattern or empty text', () => {
      expect(matchesWildcard('', 'some text')).toBe(false);
      expect(matchesWildcard('code', '')).toBe(false);
    });
  });

  describe('Vietnamese-First Keyword Routing across 10 Categories', () => {
    it('1. routes to /cook for Vietnamese build keywords', () => {
      const res = routeAsk('hãy viết code tính năng tạo avatar video');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/cook');
      expect(res.matchedLanguage).toBe('vi');
      expect(res.outputMessageVi).toContain('/cook');
      expect(res.outputMessageEn).toContain('/cook');
    });

    it('2. routes to /fix for Vietnamese debug keywords', () => {
      const res = routeAsk('sửa lỗi webhook nowpayments không nhận được signature');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/fix');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('3. routes to /test for Vietnamese testing keywords', () => {
      const res = routeAsk('chạy test kiểm tra toàn bộ luồng onboarding');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/test');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('4. routes to /plan for Vietnamese planning keywords', () => {
      const res = routeAsk('lập kế hoạch mở rộng GPU mesh sang cụm APAC');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/plan');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('5. routes to /brainstorm for Vietnamese ideation keywords', () => {
      const res = routeAsk('gợi ý ý tưởng kịch bản video viral cho ngành F&B');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/brainstorm');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('6. routes to deploy for Vietnamese deployment keywords', () => {
      const res = routeAsk('đưa lên production phiên bản release 1.0.8');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('deploy');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('7. routes to /docs for Vietnamese documentation keywords', () => {
      const res = routeAsk('viết tài liệu hướng dẫn cấu hình BYOK');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/docs');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('8. routes to analytics-report for Vietnamese analytics keywords', () => {
      const res = routeAsk('phân tích dữ liệu doanh thu tháng 6 theo từng tier');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('analytics-report');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('9. routes to /security-scan for Vietnamese security keywords', () => {
      const res = routeAsk('quét bảo mật toàn bộ các endpoint webhook trước khi go-live');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/security-scan');
      expect(res.matchedLanguage).toBe('vi');
    });

    it('10. routes to /audit-compliance for Vietnamese compliance keywords', () => {
      const res = routeAsk('kiểm toán tuân thủ chính sách bảo mật nội bộ và SOC2');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/audit-compliance');
      expect(res.matchedLanguage).toBe('vi');
    });
  });

  describe('English Keyword Routing across 10 Categories', () => {
    it('1. routes to /cook for English build keywords', () => {
      const res = routeAsk('implement customer retention flywheel in D1');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/cook');
      expect(res.matchedLanguage).toBe('en');
    });

    it('2. routes to /fix for English debug keywords', () => {
      const res = routeAsk('debug timing attack vulnerability in signature comparison');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/fix');
      expect(res.matchedLanguage).toBe('en');
    });

    it('3. routes to /test for English testing keywords', () => {
      const res = routeAsk('write unit test for BYOK envelope encryption');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/test');
      expect(res.matchedLanguage).toBe('en');
    });

    it('4. routes to /plan for English planning keywords', () => {
      const res = routeAsk('build plan for multi-region failover and disaster recovery');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/plan');
      expect(res.matchedLanguage).toBe('en');
    });

    it('5. routes to /brainstorm for English ideation keywords', () => {
      const res = routeAsk('ideate creative hooks for social media distribution');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/brainstorm');
      expect(res.matchedLanguage).toBe('en');
    });

    it('6. routes to deploy for English deployment keywords', () => {
      const res = routeAsk('push to prod with bit-for-bit edge SHA verification');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('deploy');
      expect(res.matchedLanguage).toBe('en');
    });

    it('7. routes to /docs for English documentation keywords', () => {
      const res = routeAsk('generate API readme documentation for affiliates endpoints');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/docs');
      expect(res.matchedLanguage).toBe('en');
    });

    it('8. routes to analytics-report for English analytics keywords', () => {
      const res = routeAsk('data analysis on user conversion and churn telemetry');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('analytics-report');
      expect(res.matchedLanguage).toBe('en');
    });

    it('9. routes to /security-scan for English security keywords', () => {
      const res = routeAsk('security audit on master key rotation and AES-GCM tags');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/security-scan');
      expect(res.matchedLanguage).toBe('en');
    });

    it('10. routes to /audit-compliance for English compliance keywords', () => {
      const res = routeAsk('internal audit on financial ledger and payout reconciliation');
      expect(res.mode).toBe('command-routed');
      expect(res.targetCommand).toBe('/audit-compliance');
      expect(res.matchedLanguage).toBe('en');
    });
  });

  describe('Vietnamese-First Priority Verification', () => {
    it('prioritizes Vietnamese keywords when a prompt has mixed keywords', () => {
      // Prompt has VI keyword "sửa lỗi" (fix) and EN word "code" (cook)
      const res = routeAsk('hãy sửa lỗi trong đoạn code này');
      expect(res.mode).toBe('command-routed');
      expect(res.matchedLanguage).toBe('vi');
      expect(res.targetCommand).toBe('/fix');
    });
  });

  describe('Unknown-Command Rejection', () => {
    it('rejects unrecognized slash commands with clear bilingual reasons', () => {
      const res = routeAsk('/unknown-custom-command args');
      expect(res.mode).toBe('unknown-command-rejected');
      expect(res.targetCommand).toBeUndefined();
      expect(res.rejectionReason).toBeDefined();
      expect(res.rejectionReason?.vi).toContain('không tồn tại');
      expect(res.rejectionReason?.en).toContain('does not exist');
      expect(res.outputMessageVi).toContain('❌ [Từ chối lệnh]');
      expect(res.outputMessageEn).toContain('❌ [Command Rejected]');
    });

    it('allows recognized slash commands in allowlist', () => {
      expect(RECOGNIZED_COMMANDS.has('/cook')).toBe(true);
      expect(RECOGNIZED_COMMANDS.has('/fix')).toBe(true);
      expect(RECOGNIZED_COMMANDS.has('/ask')).toBe(true);
      expect(RECOGNIZED_COMMANDS.has('/unknown-cmd')).toBe(false);
    });
  });

  describe('Backward-Compatible 4-Advisor Architecture Fallback', () => {
    it('falls back to 4-Advisor consultation when no keyword matches', () => {
      const query = 'So sánh ưu nhược điểm giữa Cloudflare D1 và PostgreSQL khi đạt quy mô 1M người dùng';
      const res = routeAsk(query);

      expect(res.mode).toBe('architecture-consultation');
      expect(res.targetCommand).toBeUndefined();
      expect(res.consultation).toBeDefined();

      const { consultation } = res;
      expect(consultation?.systemsDesigner.vi).toContain('[Hệ thống & Phân tầng]');
      expect(consultation?.systemsDesigner.en).toContain('[Systems Architecture & Boundaries]');

      expect(consultation?.technologyStrategist.vi).toContain('[Chiến lược Công nghệ]');
      expect(consultation?.technologyStrategist.en).toContain('[Technology Strategy]');

      expect(consultation?.scalabilityConsultant.vi).toContain('[Hiệu năng & Khả năng Mở rộng]');
      expect(consultation?.scalabilityConsultant.en).toContain('[Scalability & Throughput]');

      expect(consultation?.riskAnalyst.vi).toContain('[An toàn Thông tin & Giảm thiểu Rủi ro]');
      expect(consultation?.riskAnalyst.en).toContain('[Security & Risk Mitigation]');

      expect(consultation?.synthesis.vi).toContain('[Tổng kết 4 Cố Vấn]');
      expect(consultation?.synthesis.en).toContain('[4-Advisor Synthesis]');

      expect(res.outputMessageVi).toContain('🏛️ [Hội Đồng 4 Cố Vấn Kiến Trúc');
      expect(res.outputMessageEn).toContain('🏛️ [4-Advisor Architectural Consultation');
    });

    it('generateArchitecturalConsultation handles arbitrary technical questions', () => {
      const direct = generateArchitecturalConsultation('Compare MicroPython vs CircuitPython memory footprints');
      expect(direct.systemsDesigner.en).toBeTruthy();
      expect(direct.technologyStrategist.en).toBeTruthy();
      expect(direct.scalabilityConsultant.en).toBeTruthy();
      expect(direct.riskAnalyst.en).toBeTruthy();
      expect(direct.synthesis.en).toBeTruthy();
    });

    it('gracefully handles empty string fallback', () => {
      const res = routeAsk('');
      expect(res.mode).toBe('architecture-consultation');
      expect(res.consultation).toBeDefined();
    });
  });
});
