export interface MockAffiliate {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'pending';
  totalSales: number;
  totalCommission: string;
  pending: string;
  avatar: string | null;
}

export const mockAffiliates: MockAffiliate[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    email: 'sarah@partner.io',
    status: 'active',
    totalSales: 24,
    totalCommission: '$1,200',
    pending: '$450',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWSzEsLXtlCtQl1JnTEm3U6SpevfsPDoGf5AETFg_kJqGKabfczl1Ki8Pei4SD7ANALXRbw-6UgDLHRQvpjVYic1Ruql8gfEgqHV7KL9DYJpKbBvxdLiieBRVrxqcIhnJRHVIMkDmD7VqEWT951o6ciCz9VwMV9svjRL5bfsJq42_CjIASiXbLP-NtOSNxovB_IMnangbB04G2r8QWfnKrM-6qMJpncKFAA5EbcHl4bRR9dELLiRWTMJuqz4dlxMu-_nhvZw7tcEY',
  },
  {
    id: '2',
    name: 'Mark Thompson',
    email: 'mark@affiliate.net',
    status: 'active',
    totalSales: 18,
    totalCommission: '$940',
    pending: '$310',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByHOqTZvd0_lBYpj2NSkQXfZCPUKV_eVwbIm_zXv5ByFdriQ1zFvvy66kMfI1FAklZ92tIsB7HIUjOxpzzodhJwxg7XMicrxxbW9PNtpZfU6gpWqp6CQCtne5yQhhXSTyH6wCbDHSFg3yoYgp6W-PzaPyZ3BlEdoj0MMChl8VV9qv43sWBvbLce63EkggGqMSDL2PT6ahn5io6Hc2NGHUKqj0vHm2qQTH0aPyR67SS11WLiJ8pIzNfJIU3F1fKXZvmVSaO_hx6Fg',
  },
  {
    id: '3',
    name: 'Lydia Wells',
    email: 'lydia@promo.co',
    status: 'pending',
    totalSales: 12,
    totalCommission: '$600',
    pending: '$220',
    avatar: null,
  },
  {
    id: '4',
    name: 'James Chen',
    email: 'james@referral.dev',
    status: 'active',
    totalSales: 8,
    totalCommission: '$410',
    pending: '$105',
    avatar: null,
  },
];
