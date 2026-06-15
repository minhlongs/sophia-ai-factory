'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type AuthMode = 'password' | 'magic';
type PageTab = 'signin' | 'signup';

interface AuthModeContextType {
  pageTab: PageTab;
  setPageTab: (tab: PageTab) => void;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  isSignIn: boolean;
  isSignUp: boolean;
}

const AuthModeContext = createContext<AuthModeContextType | undefined>(undefined);

interface AuthModeProviderProps {
  children: ReactNode;
  initialTab?: PageTab;
}

export function AuthModeProvider({ children, initialTab = 'signin' }: AuthModeProviderProps) {
  const [pageTab, setPageTab] = useState<PageTab>(initialTab);
  const [mode, setMode] = useState<AuthMode>('password');

  const value: AuthModeContextType = {
    pageTab,
    setPageTab,
    mode,
    setMode,
    get isSignIn() {
      return pageTab === 'signin';
    },
    get isSignUp() {
      return pageTab === 'signup';
    },
  };

  return <AuthModeContext.Provider value={value}>{children}</AuthModeContext.Provider>;
}

export function useAuthMode(): AuthModeContextType {
  const context = useContext(AuthModeContext);
  if (!context) {
    throw new Error('useAuthMode must be used within AuthModeProvider');
  }
  return context;
}
