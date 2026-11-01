import { ApiError } from '@/api/client';

// Maps an API failure to a translation key for the credential/account forms.
export function authErrorKey(error: unknown, fallback: string): string {
  if (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500
  ) {
    return 'auth.serverUnreachable';
  }
  if (error.status === 401) {
    return 'auth.invalidCredentials';
  }
  if (error.status === 409) {
    const message = error.message.toLowerCase();
    return message.includes('email') && !message.includes('username')
      ? 'auth.emailExists'
      : 'auth.usernameExists';
  }
  if (error.message === 'current_password_incorrect') {
    return 'auth.currentPasswordIncorrect';
  }
  if (error.message === 'invalid_password') {
    return 'auth.passwordPolicy';
  }
  return fallback;
}
