'use client';

/**
 * Interactive Agency Client Onboarding Wizard
 *
 * Implements a comprehensive 5-step onboarding flow:
 * Step 1: Client Profile (business name, slug, contact, initial MCU)
 * Step 2: Whitelabel Branding (logo, primary/accent colors, CSS with live preview)
 * Step 3: Custom Domain & DNS configuration (CNAME target, SSL readiness)
 * Step 4: Seed Agent Deployment under AGY governance (roles, autonomy, compute limits)
 * Step 5: Review & Launch confirmation with atomic subaccount provisioning
 *
 * Layer: forest/agency (Presentation & Client Component)
 * Allowed imports: react, lucide-react, @/seed/*, @/tree/*, @/land/agency/*
 *
 * @module forest/agency/agency-onboarding-wizard
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Palette,
  Globe,
  Bot,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Shield,
  Sliders,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
  SeedAgentRole,
} from '@/seed/types';
import {
  validateProfileStep,
  validateBrandingStep,
  validateDomainStep,
  validateSeedAgentsStep,
} from '@/tree/agency/onboarding-validator';

export interface AgencyOnboardingWizardActions {
  validateStep?: (
    step: AgencyOnboardingStep,
    payload: unknown
  ) => Promise<{ valid: boolean; errors: string[] }>;
  submitOnboarding?: (
    submission: AgencyOnboardingSubmission
  ) => Promise<AgencyOnboardingResult>;
}

export interface AgencyOnboardingWizardProps {
  agencyOrgId: string;
  locale?: 'en' | 'vi';
  initialSlug?: string;
  actions?: AgencyOnboardingWizardActions;
  onSuccess?: (result: AgencyOnboardingResult) => void;
}

const DEFAULT_SEED_AGENTS: SeedAgentDeploymentConfig[] = [
  {
    agentId: 'agent_video_creator_v1',
    name: 'Video Creator Specialist',
    role: 'video_creator',
    template: 'ugc_video_generator_v1',
    maxAutonomy: 'L1',
    maxComputeUnitsMcu: 200,
    escalationPolicy: 'escalate_human',
    enabled: true,
  },
  {
    agentId: 'agent_ugc_reviewer_v1',
    name: 'Client Review Assistant',
    role: 'ugc_reviewer',
    template: 'review_collector_v1',
    maxAutonomy: 'L2',
    maxComputeUnitsMcu: 150,
    escalationPolicy: 'request_approval',
    enabled: true,
  },
  {
    agentId: 'agent_sales_outreach_v1',
    name: 'Engagement & Outreach Bot',
    role: 'sales_outreach',
    template: 'client_notifier_v1',
    maxAutonomy: 'L3',
    maxComputeUnitsMcu: 150,
    escalationPolicy: 'escalate_human',
    enabled: true,
  },
];

export function AgencyOnboardingWizard({
  agencyOrgId,
  locale = 'vi',
  initialSlug = '',
  actions,
  onSuccess,
}: AgencyOnboardingWizardProps) {
  const isVi = locale === 'vi';

  // Wizard state
  const [currentStep, setCurrentStep] = useState<AgencyOnboardingStep>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [launchResult, setLaunchResult] = useState<AgencyOnboardingResult | null>(null);

  // Step 1: Profile
  const [profile, setProfile] = useState<AgencyProfileInput>({
    clientName: '',
    agencySlug: initialSlug,
    contactEmail: '',
    industryTag: 'ecommerce',
    initialMcuBudget: 500,
  });

  // Step 2: Branding
  const [branding, setBranding] = useState<AgencyBrandingInput>({
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#0f172a',
    accentColor: '#10b981',
    customCss: '',
  });

  // Step 3: Domain
  const [domain, setDomain] = useState<AgencyDomainInput>({
    subdomain: initialSlug || '',
    customDomain: '',
    cnameTarget: 'agencyos.network',
    isSslReady: true,
  });

  // Step 4: Seed Agents
  const [seedAgents, setSeedAgents] = useState<SeedAgentDeploymentConfig[]>(DEFAULT_SEED_AGENTS);

  // Auto-slug generator from client name
  const handleClientNameChange = (name: string) => {
    const generatedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 32);

    setProfile((prev) => ({
      ...prev,
      clientName: name,
      agencySlug: prev.agencySlug ? prev.agencySlug : generatedSlug,
    }));

    if (!domain.subdomain) {
      setDomain((prev) => ({ ...prev, subdomain: generatedSlug }));
    }
  };

  // Step validation before proceeding
  const handleNextStep = async () => {
    setIsValidating(true);
    setGeneralError(null);
    setStepErrors([]);

    let payload: unknown;
    if (currentStep === 1) payload = profile;
    else if (currentStep === 2) payload = branding;
    else if (currentStep === 3) payload = domain;
    else if (currentStep === 4) payload = seedAgents;
    else payload = {};

    try {
      let result: { valid: boolean; errors: string[] } = { valid: true, errors: [] };
      if (actions?.validateStep) {
        result = await actions.validateStep(currentStep, payload);
      } else {
        if (currentStep === 1) result = validateProfileStep(payload as AgencyProfileInput);
        else if (currentStep === 2) result = validateBrandingStep(payload as AgencyBrandingInput);
        else if (currentStep === 3) result = validateDomainStep(payload as AgencyDomainInput);
        else if (currentStep === 4) result = validateSeedAgentsStep(payload as SeedAgentDeploymentConfig[]);
      }

      if (!result.valid) {
        setStepErrors(result.errors);
        setIsValidating(false);
        return;
      }

      if (currentStep < 5) {
        setCurrentStep((prev) => (prev + 1) as AgencyOnboardingStep);
      }
    } catch {
      setGeneralError(isVi ? 'Đã có lỗi xảy ra khi xác thực bước này.' : 'Error validating step data.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setGeneralError(null);
      setStepErrors([]);
      setCurrentStep((prev) => (prev - 1) as AgencyOnboardingStep);
    }
  };

  // Agent toggle and config helper
  const handleToggleAgent = (index: number) => {
    setSeedAgents((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, enabled: !agent.enabled } : agent))
    );
  };

  const handleUpdateAgentAutonomy = (index: number, level: AgyAutonomyLevel) => {
    setSeedAgents((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, maxAutonomy: level } : agent))
    );
  };

  const handleUpdateAgentMcu = (index: number, mcu: number) => {
    setSeedAgents((prev) =>
      prev.map((agent, i) =>
        i === index ? { ...agent, maxComputeUnitsMcu: Math.max(0, mcu) } : agent
      )
    );
  };

  const handleUpdateAgentEscalation = (index: number, policy: EscalationAction) => {
    setSeedAgents((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, escalationPolicy: policy } : agent))
    );
  };

  // Step 5: Final Submission
  const handleLaunch = async () => {
    setIsSubmitting(true);
    setGeneralError(null);
    setStepErrors([]);

    const submission: AgencyOnboardingSubmission = {
      agencyOrgId,
      profile,
      branding,
      domain,
      seedAgents,
    };

    try {
      if (!actions?.submitOnboarding) {
        setGeneralError(
          isVi
            ? 'Hành động kích hoạt không gian chưa được cấu hình.'
            : 'Submit action not provided.'
        );
        setIsSubmitting(false);
        return;
      }

      const res = await actions.submitOnboarding(submission);
      if (!res.success) {
        setGeneralError(res.error || (isVi ? 'Không thể hoàn tất khởi tạo.' : 'Submission failed.'));
        if (res.stepErrors) {
          const allErrors = Object.values(res.stepErrors).flat();
          setStepErrors(allErrors);
        }
        setIsSubmitting(false);
        return;
      }

      setLaunchResult(res);
      if (onSuccess) onSuccess(res);
    } catch {
      setGeneralError(
        isVi
          ? 'Lỗi máy chủ trong quá trình kích hoạt không gian khách hàng.'
          : 'Server error during workspace provisioning.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (launchResult && launchResult.success) {
    const portalPath = launchResult.portalUrl || `/portal/${launchResult.agencySlug || profile.agencySlug}`;
    return (
      <div className="max-w-3xl mx-auto p-8 bg-card rounded-2xl border border-border shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isVi ? 'Không Gian Khách Hàng Đã Sẵn Sàng!' : 'Client Workspace Live!'}
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {isVi
            ? `Tài khoản cho ${profile.clientName} cùng với ${launchResult.deployedAgentsCount || seedAgents.filter(a => a.enabled).length} trợ lý AI tự động đã được kích hoạt thành công.`
            : `Client workspace for ${profile.clientName} and ${launchResult.deployedAgentsCount || seedAgents.filter(a => a.enabled).length} autonomous seed agents are now fully active.`}
        </p>

        <div className="p-4 bg-muted/50 rounded-xl border border-border text-left max-w-md mx-auto space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isVi ? 'Đường Dẫn Cổng Thông Tin' : 'Client Portal Link'}
          </div>
          <div className="flex items-center justify-between text-sm font-mono text-foreground break-all">
            <span>{portalPath}</span>
            <Link
              href={portalPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-sans text-xs ml-2 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {isVi ? 'Mở Cổng' : 'Open'}
            </Link>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/${locale}/agency`}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm font-medium transition-colors"
          >
            {isVi ? 'Quay Lại Bảng Quản Trị' : 'Return to Agency Cockpit'}
          </Link>
          <Link
            href={portalPath}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            {isVi ? 'Truy Cập Cổng Khách Hàng' : 'Open Client Portal'}
          </Link>
        </div>
      </div>
    );
  }

  const stepsList = [
    { num: 1, label: isVi ? 'Hồ Sơ' : 'Profile', icon: Building2 },
    { num: 2, label: isVi ? 'Nhận Diện' : 'Branding', icon: Palette },
    { num: 3, label: isVi ? 'Tên Miền' : 'Domain', icon: Globe },
    { num: 4, label: isVi ? 'Trợ Lý AI' : 'Seed Agents', icon: Bot },
    { num: 5, label: isVi ? 'Kích Hoạt' : 'Launch', icon: Rocket },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Stepper Header */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          {stepsList.map((step, idx) => {
            const Icon = step.icon;
            const isPassed = currentStep > step.num;
            const isCurrent = currentStep === step.num;

            return (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isPassed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 font-bold'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPassed ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent
                        ? 'text-foreground font-semibold'
                        : isPassed
                        ? 'text-foreground/80'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div
                    className={`h-[2px] w-6 sm:w-12 transition-colors ${
                      currentStep > step.num ? 'bg-emerald-500' : 'bg-muted'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Errors Banner */}
      {(generalError || stepErrors.length > 0) && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {generalError && <p className="font-semibold">{generalError}</p>}
            {stepErrors.map((err, i) => (
              <p key={i} className="text-xs">
                • {err}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Step Content Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-md">
        {/* STEP 1: CLIENT PROFILE */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {isVi ? '1. Hồ Sơ Khách Hàng' : '1. Client Profile'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isVi
                  ? 'Khai báo thông tin cơ bản của doanh nghiệp khách hàng để thiết lập không gian riêng biệt.'
                  : 'Specify basic enterprise information to configure the isolated workspace.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Tên Doanh Nghiệp Khách Hàng *' : 'Client Business Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isVi ? 'Ví dụ: Tập Đoàn Truyền Thông Á Châu' : 'e.g. Acme Media Group'}
                  value={profile.clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Đường Dẫn Không Gian (Slug) *' : 'Workspace Slug *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="acme-media"
                  value={profile.agencySlug}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      agencySlug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {isVi
                    ? 'Đường dẫn cổng thông tin: agencyos.network/portal/[slug]'
                    : 'Portal address: agencyos.network/portal/[slug]'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Email Liên Hệ Chính *' : 'Primary Contact Email *'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="contact@client.com"
                  value={profile.contactEmail}
                  onChange={(e) => setProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Lĩnh Vực Hoạt Động' : 'Industry Category'}
                </label>
                <select
                  value={profile.industryTag}
                  onChange={(e) => setProfile((prev) => ({ ...prev, industryTag: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-Commerce'}</option>
                  <option value="marketing_agency">{isVi ? 'Đại Lý Tiếp Thị / Agency' : 'Marketing Agency'}</option>
                  <option value="content_creator">{isVi ? 'Nhà Sáng Tạo Nội Dung' : 'Content Creator'}</option>
                  <option value="saas">{isVi ? 'Công Nghệ Phần Mềm (SaaS)' : 'SaaS / Tech'}</option>
                  <option value="retail">{isVi ? 'Bán Lẻ & Dịch Vụ' : 'Retail & Services'}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Hạn Mức Điểm Sản Xuất (MCU) *' : 'Initial Credit Quota (MCU) *'}
                </label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={profile.initialMcuBudget}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      initialMcuBudget: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {isVi
                    ? 'Hạn mức điểm dùng cho kết xuất video và các tác vụ trợ lý tự động.'
                    : 'Compute points allocated for rendering videos and autonomous agent tasks.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BRANDING & LIVE UNBRANDED PREVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {isVi ? '2. Nhận Diện Thương Hiệu' : '2. White-Label Branding'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isVi
                  ? 'Tùy biến màu sắc, biểu tượng để mang lại trải nghiệm thương hiệu trọn vẹn cho khách hàng.'
                  : 'Customize colors and logo to deliver an unbranded portal tailored for your client.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Controls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {isVi ? 'Đường Dẫn Logo (URL)' : 'Logo Image URL'}
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={branding.logoUrl || ''}
                    onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {isVi ? 'Màu Chủ Đạo' : 'Primary Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.primaryColor || '#0f172a'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
                      />
                      <input
                        type="text"
                        value={branding.primaryColor || '#0f172a'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 font-mono text-xs bg-background border border-input rounded text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {isVi ? 'Màu Điểm Nhấn' : 'Accent Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.accentColor || '#10b981'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, accentColor: e.target.value }))
                        }
                        className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
                      />
                      <input
                        type="text"
                        value={branding.accentColor || '#10b981'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, accentColor: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 font-mono text-xs bg-background border border-input rounded text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {isVi ? 'Tùy Biến CSS Bổ Sung' : 'Custom CSS (Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder=".client-portal { border-radius: 8px; }"
                    value={branding.customCss || ''}
                    onChange={(e) => setBranding((prev) => ({ ...prev, customCss: e.target.value }))}
                    className="w-full px-3.5 py-2 font-mono text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isVi
                      ? 'Bộ lọc tự động loại bỏ các đoạn mã độc hại để đảm bảo an toàn.'
                      : 'Security sanitizer automatically strips script tags and malicious attributes.'}
                  </p>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-5 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      {isVi ? 'Xem Trước Giao Diện Cổng Khách Hàng' : 'Live Unbranded Preview'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                      {isVi ? 'Thương Hiệu Riêng' : '100% Unbranded'}
                    </span>
                  </div>

                  <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden text-left">
                    {/* Fake Header */}
                    <div
                      className="px-4 py-3 flex items-center justify-between border-b"
                      style={{
                        backgroundColor: branding.primaryColor || '#0f172a',
                        color: '#ffffff',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {branding.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={branding.logoUrl}
                            alt="Logo"
                            className="h-6 w-auto object-contain max-w-[100px]"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
                            {(profile.clientName || 'C')[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-xs tracking-tight">
                          {profile.clientName || (isVi ? 'Tên Khách Hàng' : 'Client Name')}
                        </span>
                      </div>
                      <div
                        className="px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: branding.accentColor || '#10b981',
                          color: '#ffffff',
                        }}
                      >
                        {isVi ? 'Cổng Khách' : 'Portal'}
                      </div>
                    </div>

                    {/* Fake Portal Body */}
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-16 bg-muted/60 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                        {isVi ? 'Khu vực duyệt video và tài liệu' : 'Video Deliverable Review Space'}
                      </div>
                      <div className="flex justify-end gap-2">
                        <div
                          className="px-3 py-1 rounded text-xs font-medium text-white shadow-sm"
                          style={{ backgroundColor: branding.accentColor || '#10b981' }}
                        >
                          {isVi ? 'Phê Duyệt Video' : 'Approve Draft'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-4 text-center">
                  {isVi
                    ? 'Giao diện không hiển thị tên Sophia AI Factory khi khách hàng truy cập.'
                    : 'Zero references to Sophia AI Factory shown to your clients.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CUSTOM DOMAIN & DNS CONFIGURATION */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {isVi ? '3. Tên Miền Riêng' : '3. Custom Domain & DNS'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isVi
                  ? 'Gắn tên miền riêng để cổng thông tin hoạt động trực tiếp dưới địa chỉ của doanh nghiệp.'
                  : 'Map a sovereign hostname so client portals operate under your enterprise domain.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isVi ? 'Tên Miền Tùy Chỉnh (FQDN)' : 'Custom Domain (FQDN)'}
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="portal.clientbrand.com"
                    value={domain.customDomain || ''}
                    onChange={(e) =>
                      setDomain((prev) => ({
                        ...prev,
                        customDomain: e.target.value.toLowerCase().trim(),
                      }))
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isVi
                    ? 'Bạn có thể để trống nếu chỉ muốn dùng đường dẫn mặc định: agencyos.network/portal/[slug]'
                    : 'Optional. Leave blank to use the default URL: agencyos.network/portal/[slug]'}
                </p>
              </div>

              {/* DNS Instruction Card */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    {isVi ? 'Hướng Dẫn Cấu Hình DNS CNAME' : 'DNS CNAME Configuration'}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isVi ? 'SSL Tự Động Sẵn Sàng' : 'Automated Edge SSL'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-card p-3 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-sans">
                      {isVi ? 'Loại Bản Ghi' : 'Record Type'}
                    </span>
                    <span className="font-bold text-foreground">CNAME</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-sans">
                      {isVi ? 'Tên Máy Chủ' : 'Host / Name'}
                    </span>
                    <span className="text-foreground">
                      {domain.customDomain ? domain.customDomain.split('.')[0] : 'portal'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-sans">
                      {isVi ? 'Giá Trị Trỏ Về' : 'Target / Value'}
                    </span>
                    <span className="text-primary font-bold">agencyos.network</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SEED AGENT DEPLOYMENT UNDER AGY GOVERNANCE */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {isVi ? '4. Kích Hoạt Trợ Lý AI Tự Động' : '4. Deploy Seed Agents'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isVi
                  ? 'Thiết lập các trợ lý AI với mức độ tự chủ và ngân sách điểm được kiểm soát bởi chính sách AGY.'
                  : 'Configure autonomous workers governed by deterministic AGY safety and budget policies.'}
              </p>
            </div>

            <div className="space-y-3">
              {seedAgents.map((agent, idx) => {
                return (
                  <div
                    key={agent.agentId}
                    className={`p-4 rounded-xl border transition-all ${
                      agent.enabled
                        ? 'bg-card border-border shadow-sm'
                        : 'bg-muted/30 border-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={agent.enabled}
                          onChange={() => handleToggleAgent(idx)}
                          className="w-4 h-4 rounded text-primary border-input mt-1 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                            {agent.name}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {agent.role}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {agent.role === 'video_creator'
                              ? isVi
                                ? 'Tự động tạo kịch bản video, ghép cảnh và xuất bản thảo.'
                                : 'Generates avatar drafts, UGC clips, and marketing videos.'
                              : agent.role === 'ugc_reviewer'
                              ? isVi
                                ? 'Tiếp nhận ý kiến đánh giá theo dòng thời gian từ khách hàng.'
                                : 'Captures client feedback, timecoded notes, and revision requests.'
                              : isVi
                              ? 'Tự động gửi thông báo cập nhật tiến độ đến khách hàng.'
                              : 'Automates notification dispatches and client follow-ups.'}
                          </p>
                        </div>
                      </div>

                      {/* Controls */}
                      {agent.enabled && (
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end pt-2 sm:pt-0">
                          {/* Autonomy Level */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {isVi ? 'Tự chủ:' : 'Autonomy:'}
                            </span>
                            <select
                              value={agent.maxAutonomy}
                              onChange={(e) =>
                                handleUpdateAgentAutonomy(idx, e.target.value as AgyAutonomyLevel)
                              }
                              className="px-2 py-1 bg-background border border-input rounded text-xs text-foreground"
                            >
                              <option value="L0">{isVi ? 'Thủ công (L0)' : 'Manual (L0)'}</option>
                              <option value="L1">{isVi ? 'Có giám sát (L1)' : 'Assisted (L1)'}</option>
                              <option value="L2">{isVi ? 'Theo dõi (L2)' : 'Monitored (L2)'}</option>
                              <option value="L3">{isVi ? 'Tự động (L3)' : 'Autonomous (L3)'}</option>
                              <option value="L4">{isVi ? 'Tối cao (L4)' : 'Sovereign (L4)'}</option>
                            </select>
                          </div>

                          {/* MCU Budget */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">MCU:</span>
                            <input
                              type="number"
                              min="10"
                              step="10"
                              value={agent.maxComputeUnitsMcu}
                              onChange={(e) =>
                                handleUpdateAgentMcu(idx, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-16 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono"
                            />
                          </div>

                          {/* Escalation Policy */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {isVi ? 'Xử lý vượt:' : 'Over-quota:'}
                            </span>
                            <select
                              value={agent.escalationPolicy}
                              onChange={(e) =>
                                handleUpdateAgentEscalation(idx, e.target.value as EscalationAction)
                              }
                              className="px-2 py-1 bg-background border border-input rounded text-xs text-foreground"
                            >
                              <option value="escalate_human">
                                {isVi ? 'Báo quản trị' : 'Alert Admin'}
                              </option>
                              <option value="request_approval">
                                {isVi ? 'Yêu cầu duyệt' : 'Request Approval'}
                              </option>
                              <option value="halt">{isVi ? 'Dừng hẳn' : 'Halt'}</option>
                              <option value="degrade_gracefully">
                                {isVi ? 'Giảm tải an toàn' : 'Degrade Gracefully'}
                              </option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & LAUNCH */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {isVi ? '5. Xác Nhận & Kích Hoạt Không Gian' : '5. Review & Launch'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isVi
                  ? 'Kiểm tra lại toàn bộ thông tin trước khi kích hoạt không gian làm việc và triển khai trợ lý AI.'
                  : 'Review all configuration parameters before provisioning client workspace and deploying agents.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isVi ? 'Hồ Sơ Doanh Nghiệp' : 'Enterprise Profile'}
                </span>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">{isVi ? 'Tên:' : 'Name:'}</span>{' '}
                    <span className="font-semibold text-foreground">{profile.clientName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">{isVi ? 'Đường dẫn:' : 'Slug:'}</span>{' '}
                    <span className="font-mono text-foreground">{profile.agencySlug}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email:</span>{' '}
                    <span className="text-foreground">{profile.contactEmail}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {isVi ? 'Hạn mức điểm:' : 'Quota:'}
                    </span>{' '}
                    <span className="font-bold text-primary">{profile.initialMcuBudget} MCU</span>
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isVi ? 'Nhận Diện & Tên Miền' : 'Branding & Domain'}
                </span>
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">{isVi ? 'Màu chủ đạo:' : 'Primary:'}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border border-border"
                      style={{ backgroundColor: branding.primaryColor || '#0f172a' }}
                    />
                    <span className="font-mono text-xs">{branding.primaryColor}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">{isVi ? 'Màu nhấn:' : 'Accent:'}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border border-border"
                      style={{ backgroundColor: branding.accentColor || '#10b981' }}
                    />
                    <span className="font-mono text-xs">{branding.accentColor}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">{isVi ? 'Tên miền:' : 'Domain:'}</span>{' '}
                    <span className="font-mono text-foreground">
                      {domain.customDomain || `portal/${profile.agencySlug}`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isVi ? 'Trợ Lý AI Sẽ Triển Khai' : 'Seed Agents Deployed'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {seedAgents
                    .filter((a) => a.enabled)
                    .map((a) => (
                      <div
                        key={a.agentId}
                        className="p-2.5 rounded-lg bg-card border border-border text-xs space-y-1"
                      >
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {a.name}
                        </div>
                        <div className="text-muted-foreground">
                          {isVi ? 'Cấp:' : 'Autonomy:'} {a.maxAutonomy} | {a.maxComputeUnitsMcu} MCU
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isSubmitting || isValidating}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                {isVi ? 'Quay Lại' : 'Previous Step'}
              </button>
            )}
          </div>

          <div>
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isValidating}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isValidating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {isVi ? 'Tiếp Tục' : 'Continue'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {isVi ? 'Đang Khởi Tạo Không Gian...' : 'Provisioning Workspace...'}
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    {isVi ? 'Kích Hoạt Cổng Khách Hàng Ngay' : 'Launch Client Portal Now'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
