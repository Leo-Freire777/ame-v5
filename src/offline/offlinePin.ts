import * as bcrypt from 'bcryptjs';

const OFFLINE_PIN_KEY = 'ame-offline-pin-hash';

/**
 * Verifica se existe um PIN offline armazenado
 */
export function hasOfflinePin(): boolean {
  const hash = localStorage.getItem(OFFLINE_PIN_KEY);
  return !!hash;
}

/**
 * Salva um novo PIN offline com hash bcrypt
 * @param pin - PIN de 4-8 dígitos (somente números)
 */
export async function setOfflinePin(pin: string): Promise<void> {
  // Validação básica
  if (!pin || pin.length < 4 || pin.length > 8) {
    throw new Error('PIN deve ter entre 4 e 8 dígitos');
  }
  if (!/^\d+$/.test(pin)) {
    throw new Error('PIN deve conter apenas números');
  }

  // Hash com bcryptjs
  const hash = bcrypt.hashSync(pin, 10);
  localStorage.setItem(OFFLINE_PIN_KEY, hash);
}

/**
 * Verifica se o PIN fornecido corresponde ao hash armazenado
 * @param pin - PIN fornecido pelo usuário
 * @returns true se o PIN está correto
 */
export async function verifyOfflinePin(pin: string): Promise<boolean> {
  const hash = localStorage.getItem(OFFLINE_PIN_KEY);
  if (!hash) {
    return false;
  }

  try {
    return bcrypt.compareSync(pin, hash);
  } catch (err) {
    console.error('[OfflinePin] Erro ao verificar PIN:', err);
    return false;
  }
}

/**
 * Remove o PIN offline armazenado
 */
export function clearOfflinePin(): void {
  localStorage.removeItem(OFFLINE_PIN_KEY);
}
