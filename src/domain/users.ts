const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePassword(password: string): boolean {
  return (
    password.length >= 5 &&
    [...password].some(
      (character) =>
        character.toUpperCase() === character &&
        character.toLowerCase() !== character,
    ) &&
    [...password].some((character) => !/[\p{L}\p{N}]/u.test(character))
  );
}

export function validateEmail(email: string): boolean {
  return emailPattern.test(email);
}
