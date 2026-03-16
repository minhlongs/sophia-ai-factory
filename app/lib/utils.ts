import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'VND' | 'USD' = 'VND'): string {
  // Handle invalid numbers
  if (!Number.isFinite(amount)) {
    return currency === 'VND' ? '0M VND' : '$0';
  }

  if (currency === 'VND') {
    return `${(amount / 1_000_000).toFixed(0)}M VND`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}

export function formatNumber(num: number): string {
  // Handle invalid numbers
  if (!Number.isFinite(num)) {
    return '0';
  }
  return num.toLocaleString('en-US');
}
