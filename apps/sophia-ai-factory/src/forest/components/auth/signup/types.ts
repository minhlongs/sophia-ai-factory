// i18n-namespace: auth.signup

export interface SignupTranslations {
  name_label: string;
  name_placeholder: string;
  email_label: string;
  email_placeholder: string;
  password_label: string;
  password_placeholder: string;
  confirm_label: string;
  confirm_placeholder: string;
  submit: string;
  submitting: string;
  success_title: string;
  success_message: string;
  error_password_mismatch: string;
  error_password_too_short: string;
  error_email_exists: string;
  error_generic: string;
}

export interface SignupFormProps {
  /** i18n strings — caller passes from server component or static keys */
  t: SignupTranslations;
}

export interface CredentialsFieldsProps {
  t: SignupTranslations;
  name: string;
  email: string;
  password: string;
  confirm: string;
  error: string | null;
  onNameChange: (val: string) => void;
  onEmailChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
  onConfirmChange: (val: string) => void;
}
