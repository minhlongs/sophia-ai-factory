'use client';

/**
 * Client context providing tenant brand kit to UI components.
 *
 * Layer: forest (UI component composition)
 * Allowed imports: react, @/seed/*, @/tree/*
 *
 * @module forest/theme/white-label-context
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { ResolvedTenantBranding } from '@/seed/types/white-label-branding';

const WhiteLabelBrandContext = createContext<ResolvedTenantBranding | null>(null);

export interface WhiteLabelBrandProviderProps {
  branding: ResolvedTenantBranding | null;
  children: ReactNode;
}

export function WhiteLabelBrandProvider({
  branding,
  children,
}: WhiteLabelBrandProviderProps) {
  return (
    <WhiteLabelBrandContext.Provider value={branding}>
      {children}
    </WhiteLabelBrandContext.Provider>
  );
}

export function useWhiteLabelBrand(): ResolvedTenantBranding | null {
  return useContext(WhiteLabelBrandContext);
}
