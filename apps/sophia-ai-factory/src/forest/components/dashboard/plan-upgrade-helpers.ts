import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

export interface CheckoutResponse {
	url?: string;
	orderId?: string;
	error?: string;
	redirectTo?: string;
	status?: string;
	handoverId?: string;
	magicLink?: string;
}

export const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export function formatPeriodEndDisplay(
	effectiveTier: Tier,
	handoverId: string | null,
	periodEnd: string | null | undefined,
	locale: string,
): string | null {
	if (effectiveTier === 'MASTER' && handoverId) {
		return 'Lifetime — never expires';
	}
	if (!periodEnd) {
		return null;
	}
	if (UNIFIED_TIERS[effectiveTier]?.billingType === 'lifetime') {
		return 'Lifetime — never expires';
	}
	return `Renews ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(periodEnd))}`;
}

export async function triggerTierCheckout(tier: Tier, locale: string): Promise<void> {
	try {
		const res = await fetch('/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tier }),
		});
		const data = (await res.json()) as CheckoutResponse;

		if (res.status === 401 && data.redirectTo) {
			window.location.href = data.redirectTo;
			return;
		}
		if (data.status === 'free_order_completed') {
			window.location.href = `/${locale}/dashboard?handover=${data.handoverId}`;
		} else if (data.url) {
			window.location.href = data.url;
		} else {
			alert(data.error || 'Checkout failed. Please try again.');
		}
	} catch {
		alert('Network error. Please try again.');
	}
}
