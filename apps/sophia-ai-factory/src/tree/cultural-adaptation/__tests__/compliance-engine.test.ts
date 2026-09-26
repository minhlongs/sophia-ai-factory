/**
 * Regional Advertising & AI Compliance Engine Unit Tests
 *
 * Covers:
 * 1. EU AI Act Article 50 synthetic disclosure & prohibited claims
 * 2. US FTC endorsement guides & deceptive AI persona rules
 * 3. Japan 景表法 stealth marketing (ステマ) & 優良誤認/有利誤認 rules
 * 4. Vietnam Decree 13/2023/NĐ-CP & Luật Quảng cáo compliance
 * 5. Singapore IMDA / PDPA & Global baseline compliance
 * 6. Automated compliance remediation
 * 7. AI watermark and audio disclaimer generation
 * 8. Audit log record generator for D1 persistence
 *
 * @module tree/cultural-adaptation/__tests__/compliance-engine.test
 */

import { describe, it, expect } from 'vitest';
import {
  scanContentCompliance,
  generateAiDisclosure,
  remediateContentCompliance,
  createContentAuditRecord,
} from '../compliance-engine';

describe('Regional Ad Compliance Engine (tree/cultural-adaptation)', () => {
  // ── 1. EU AI Act Compliance ────────────────────────────────────────────────
  describe('EU AI Act Validation', () => {
    it('flags prohibited claims under EU AI Act and Consumer Protection rules', () => {
      const script = 'Invest today for a 100% guaranteed return with zero risk and miracle cure!';
      const res = scanContentCompliance(script, 'EU');

      expect(res.compliant).toBe(false);
      expect(res.violations.length).toBeGreaterThanOrEqual(1);
      expect(res.violations[0].category).toBe('consumer_protection');
      expect(res.violations[0].severity).toBe('error');
    });

    it('flags deceptive synthetic claims under EU AI Act Article 50', () => {
      const script = 'Trust our advice because this is a real human spokesperson, not an AI!';
      const res = scanContentCompliance(script, 'EU');

      expect(res.compliant).toBe(false);
      const deepfakeViolation = res.violations.find((v) => v.ruleId === 'eu-ai-act-unlabeled-deepfake');
      expect(deepfakeViolation).toBeDefined();
    });

    it('requires mandatory watermark and audio disclosure in EU jurisdiction', () => {
      const script = 'Welcome to our enterprise product showcase.';
      const res = scanContentCompliance(script, 'EU', { hasAiVoice: true });

      expect(res.compliant).toBe(true);
      expect(res.requiredLabels.watermarkRequired).toBe(true);
      expect(res.requiredLabels.audioDisclosureRequired).toBe(true);
      expect(res.requiredLabels.audioDisclaimerText).toBeDefined();
      expect(res.requiredLabels.position).toBe('bottom_right');
    });
  });

  // ── 2. US FTC Endorsement & Synthetic Media ────────────────────────────────
  describe('US FTC Endorsement Validation', () => {
    it('flags deceptive claims such as FDA approved AI and guaranteed profit', () => {
      const script = 'Try our revolutionary FDA approved AI system for guaranteed profit.';
      const res = scanContentCompliance(script, 'US');

      expect(res.compliant).toBe(false);
      const ftcViolation = res.violations.find((v) => v.ruleId === 'us-ftc-endorsement-false-doctor');
      expect(ftcViolation).toBeDefined();
    });

    it('warns when synthetic persona claims personal product experience without disclosure', () => {
      const script = 'I am a real customer speaking from my personal experience with this product.';
      const res = scanContentCompliance(script, 'US');

      const warning = res.violations.find((v) => v.severity === 'warning');
      expect(warning).toBeDefined();
      expect(warning?.ruleId).toBe('us-ftc-deceptive-ai-persona');
    });
  });

  // ── 3. Japan 景表法 (景品表示法) ───────────────────────────────────────────
  describe('Japan 景表法 (Consumer Affairs Agency) Validation', () => {
    it('flags stealth marketing and superior quality misrepresentation (優良誤認)', () => {
      const script = '当社のAIソリューションは世界一で、ナンバーワンの実績です。絶対に儲かる投資です。';
      const res = scanContentCompliance(script, 'JP');

      expect(res.compliant).toBe(false);
      expect(res.violations.some((v) => v.matchedText.includes('世界一'))).toBe(true);
      expect(res.violations.some((v) => v.matchedText.includes('ナンバーワン'))).toBe(true);
      expect(res.violations.some((v) => v.matchedText.includes('絶対に儲かる'))).toBe(true);
    });

    it('requires PR and AI disclosure labels in Japan', () => {
      const script = '最新のビジネスAI自動化ツールをご紹介します。';
      const res = scanContentCompliance(script, 'JP', { hasAiVoice: true });

      expect(res.compliant).toBe(true);
      expect(res.requiredLabels.localLabelText).toContain('PR / AI生成動画');
      expect(res.requiredLabels.audioDisclaimerText).toContain('本動画の音声および映像はSophia AIにより生成されています');
    });
  });

  // ── 4. Vietnam Decree 13 & Luật Quảng Cáo ───────────────────────────────────
  describe('Vietnam Decree 13 & Advertising Law Validation', () => {
    it('flags unauthorized medical and cure-all claims under Vietnam law', () => {
      const script = 'Sản phẩm của chúng tôi cam kết chữa khỏi 100%, trị dứt bệnh tận gốc như thuốc tiên.';
      const res = scanContentCompliance(script, 'VN');

      expect(res.compliant).toBe(false);
      expect(res.violations.some((v) => v.matchedText.includes('chữa khỏi 100%'))).toBe(true);
    });

    it('flags deceptive AI persona claims pretending to be real human doctors', () => {
      const script = 'Tôi là bác sĩ trực tiếp khám, người thật 100% không phải AI!';
      const res = scanContentCompliance(script, 'VN');

      expect(res.compliant).toBe(false);
      expect(res.violations.some((v) => v.ruleId === 'vn-decree13-ai-persona-disclosure')).toBe(true);
    });

    it('generates mandatory Decree 13 Vietnamese AI disclosure label', () => {
      const script = 'Giới thiệu giải pháp video marketing thông minh.';
      const res = scanContentCompliance(script, 'VN');

      expect(res.requiredLabels.localLabelText).toBe('Nội dung được tạo bằng trí tuệ nhân tạo (Sophia AI)');
      expect(res.requiredLabels.audioDisclaimerText).toContain('trí tuệ nhân tạo Sophia AI');
    });
  });

  // ── 5. Automated Remediation ────────────────────────────────────────────────
  describe('Automated Content Remediation', () => {
    it('automatically sanitizes non-compliant terms with legal alternatives', () => {
      const script = 'Invest in our zero risk program for a 100% guaranteed return!';
      const rem = remediateContentCompliance(script, 'EU');

      expect(rem.remediatedScript).not.toContain('zero risk');
      expect(rem.remediatedScript).not.toContain('100% guaranteed return');
      expect(rem.replacements.length).toBeGreaterThanOrEqual(1);
    });

    it('sanitizes Vietnamese misleading health claims with approved wording', () => {
      const script = 'Thảo dược giúp cam kết dứt điểm và chữa khỏi 100%.';
      const rem = remediateContentCompliance(script, 'VN');

      expect(rem.remediatedScript).not.toContain('cam kết dứt điểm');
      expect(rem.remediatedScript).toContain('hỗ trợ cải thiện hiệu quả');
    });
  });

  // ── 6. Disclosure Generator & Audit Logger ─────────────────────────────────
  describe('AI Disclosure & Content Audit Record Generation', () => {
    it('generates structured visual watermark and audio disclaimer metadata', () => {
      const disclosure = generateAiDisclosure('EU', 'both');

      expect(disclosure.visualLabel.position).toBe('bottom_right');
      expect(disclosure.visualLabel.textEn).toContain('Sophia AI');
      expect(disclosure.audioDisclaimer).toBeDefined();
      expect(disclosure.audioDisclaimer?.estimatedDurationSec).toBeGreaterThan(0);
    });

    it('creates an immutable audit log record for D1 persistence', () => {
      const record = createContentAuditRecord({
        tenantId: 'tenant-enterprise-001',
        videoId: 'video-global-789',
        jurisdiction: 'EU',
        script: 'Invest with zero risk and instant riches!',
        auditedBy: 'compliance_worker',
      });

      expect(record.id).toMatch(/^audit-/);
      expect(record.tenantId).toBe('tenant-enterprise-001');
      expect(record.videoId).toBe('video-global-789');
      expect(record.regionCode).toBe('EU');
      expect(record.complianceStatus).toBe('rejected');
      expect(record.violationsDetected.length).toBeGreaterThan(0);
      expect(record.aiLabelInjected).toBe(true);
      expect(record.auditedBy).toBe('compliance_worker');
    });
  });
});
