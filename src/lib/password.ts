// Password rules shared by Forgot password and Settings → My profile.

export interface PasswordRule {
  id: 'length' | 'upper' | 'lower' | 'number' | 'symbol';
  label: string;
  ok: boolean;
}

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { id: 'length', label: 'At least 8 characters', ok: pw.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(pw) },
    { id: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(pw) },
    { id: 'number', label: 'One number', ok: /\d/.test(pw) },
    { id: 'symbol', label: 'One special character', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export const isStrongPassword = (pw: string) => passwordRules(pw).every((r) => r.ok);

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
