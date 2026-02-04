import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'VND' | 'USD' = 'VND'): string {
  if (currency === 'VND') {
    return `${(amount / 1_000_000).toFixed(0)}M VND`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}
