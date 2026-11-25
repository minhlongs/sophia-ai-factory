export interface LoginFormProps {
  redirectTo?: string;
  emailOtpEnabled?: boolean;
}

export interface LoginState {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  magicLinkLoading: boolean;
}
