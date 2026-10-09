'use client';

import { useState } from 'react';
import type { PartnerDashboardData, PartnerType, PayoutRail } from '@/tree/partners/types';

export function usePartnerPortalState(initialDashboard: PartnerDashboardData | null) {
  const [dashboard, setDashboard] = useState<PartnerDashboardData | null>(initialDashboard);
  const [copied, setCopied] = useState(false);

  // Registration Form State
  const [registerName, setRegisterName] = useState('');
  const [registerType, setRegisterType] = useState<PartnerType>('agency');
  const [registerCode, setRegisterCode] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  // White-Label Config State
  const [wlBrandName, setWlBrandName] = useState(dashboard?.whitelabelConfig?.brand_name || '');
  const [wlDomain, setWlDomain] = useState(dashboard?.whitelabelConfig?.custom_domain || '');
  const [wlPrimaryColor, setWlPrimaryColor] = useState(dashboard?.whitelabelConfig?.primary_color || '#06b6d4');
  const [wlAccentColor, setWlAccentColor] = useState(dashboard?.whitelabelConfig?.accent_color || '#3b82f6');
  const [wlLogoUrl, setWlLogoUrl] = useState(dashboard?.whitelabelConfig?.logo_url || '');
  const [wlSupportUrl, setWlSupportUrl] = useState(dashboard?.whitelabelConfig?.support_url || '');
  const [wlSuccessMsg, setWlSuccessMsg] = useState<string | null>(null);
  const [wlErrorMsg, setWlErrorMsg] = useState<string | null>(null);
  const [dnsVerifyMsg, setDnsVerifyMsg] = useState<string | null>(null);

  // Payout Request State
  const [payoutAmount, setPayoutAmount] = useState('100');
  const [payoutRail, setPayoutRail] = useState<PayoutRail>('USDT');
  const [payoutDest, setPayoutDest] = useState('');
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [payoutErrorMsg, setPayoutErrorMsg] = useState<string | null>(null);

  return {
    dashboard,
    setDashboard,
    copied,
    setCopied,
    registerName,
    setRegisterName,
    registerType,
    setRegisterType,
    registerCode,
    setRegisterCode,
    registerError,
    setRegisterError,
    wlBrandName,
    setWlBrandName,
    wlDomain,
    setWlDomain,
    wlPrimaryColor,
    setWlPrimaryColor,
    wlAccentColor,
    setWlAccentColor,
    wlLogoUrl,
    setWlLogoUrl,
    wlSupportUrl,
    setWlSupportUrl,
    wlSuccessMsg,
    setWlSuccessMsg,
    wlErrorMsg,
    setWlErrorMsg,
    dnsVerifyMsg,
    setDnsVerifyMsg,
    payoutAmount,
    setPayoutAmount,
    payoutRail,
    setPayoutRail,
    payoutDest,
    setPayoutDest,
    payoutSuccessMsg,
    setPayoutSuccessMsg,
    payoutErrorMsg,
    setPayoutErrorMsg,
  };
}
