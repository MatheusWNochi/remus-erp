/**
 * Formatação sensível a locale. As telas passam o locale ativo do next-intl,
 * para que número, moeda e data não divirjam entre pt e en.
 */

type Decimalish = { toString(): string } | number | string | null | undefined;

/** Converte `Decimal` do Prisma (ou string/number) em number. */
export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number(value.toString());

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: Decimalish, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: locale.startsWith('pt') ? 'BRL' : 'USD',
  }).format(toNumber(value));
}

export function formatNumber(value: Decimalish, locale: string, maximumFractionDigits = 3): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(toNumber(value));
}

export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: Date | string | null | undefined, locale: string): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined, locale: string): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** Máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00). */
export function formatDocument(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return value ?? '—';
}

/** Máscara de telefone brasileiro, com 8 ou 9 dígitos. */
export function formatPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return value ?? '—';
}

export function formatZipCode(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');

  return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : value ?? '—';
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}
