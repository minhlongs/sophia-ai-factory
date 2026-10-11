export interface LoginFormProps {
  redirectTo?: string;
}

export interface LoginState {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  magicLinkLoading: boolean;
}
