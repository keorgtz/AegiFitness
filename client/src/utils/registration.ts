export const PASSWORD_HELP = "Al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.";

export function passwordError(password: string): string | undefined {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    return PASSWORD_HELP;
  }
}

export function registrationErrors(account: { username: string; email: string; displayName: string; password: string }, confirmation: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9._@+-]{3,32}$/.test(account.username)) errors.username = "Usa entre 3 y 32 caracteres: letras sin acentos, números o . _ - @ +.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) errors.email = "Ingresa un correo válido.";
  if (!account.displayName || account.displayName.length > 64) errors.displayName = "Ingresa un nombre de hasta 64 caracteres.";
  const error = passwordError(account.password);
  if (error) errors.password = error;
  if (account.password !== confirmation) errors.confirmPassword = "Las contraseñas no coinciden.";
  return errors;
}
