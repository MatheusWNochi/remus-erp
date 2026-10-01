import { onlyDigits } from './format';

/**
 * Validação de dígito verificador de CPF e CNPJ.
 *
 * Checar só o tamanho deixa passar documento digitado errado, que depois vira
 * nota fiscal rejeitada — por isso o cálculo completo.
 */

function isRepeatedSequence(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== 11 || isRepeatedSequence(digits)) {
    return false;
  }

  const checkDigit = (length: number): number => {
    let sum = 0;

    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }

    const remainder = (sum * 10) % 11;

    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || isRepeatedSequence(digits)) {
    return false;
  }

  const checkDigit = (length: number): number => {
    // Pesos vão de 2 a 9, ciclicamente, da direita para a esquerda.
    let sum = 0;
    let weight = length - 7;

    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight;
      weight -= 1;

      if (weight < 2) {
        weight = 9;
      }
    }

    const remainder = sum % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  if (digits.length === 14) {
    return isValidCnpj(digits);
  }

  return false;
}

/** Aplica a máscara enquanto o usuário digita, sem travar a edição. */
export function maskDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }

  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function maskZipCode(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}
