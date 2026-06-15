import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Finance | Sophia AI',
  description: 'Financial reports, MRR, and revenue analytics',
};

export default function FinanceRedirectPage() {
  redirect('/dashboard/finance/reports');
}
