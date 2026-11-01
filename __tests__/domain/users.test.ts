import { describe, expect, it } from '@jest/globals';
import { validateEmail, validatePassword } from '@/domain/users';

describe('user validation rules', () => {
  it('requires at least five characters, an uppercase letter, and a special character', () => {
    expect(validatePassword('Abc!1')).toBe(true);
    expect(validatePassword('abc!1')).toBe(false);
    expect(validatePassword('Abcde')).toBe(false);
    expect(validatePassword('A!1')).toBe(false);
  });

  it('validates email format', () => {
    expect(validateEmail('member@example.com')).toBe(true);
    expect(validateEmail('member.example.com')).toBe(false);
    expect(validateEmail('member @example.com')).toBe(false);
  });
});
