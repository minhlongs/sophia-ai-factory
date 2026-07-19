export interface AgencyBranding {
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  customDomain: string | null
  displayName: string
  taglineVi: string
  taglineEn: string
}

export const DEFAULT_BRANDING: AgencyBranding = {
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  logoUrl: null,
  customDomain: null,
  displayName: 'My Agency',
  taglineVi: 'Giải pháp AI Video tự động',
  taglineEn: 'AI Video Automation Solution',
}
