'use client';

import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'default';

type Props = {
  label: string;
  tone: StatusTone;
  size?: ChipProps['size'];
};

/**
 * Chip de status padronizado. Centralizar o mapa tom -> cor evita que cada
 * módulo invente a própria convenção (um "ativo" verde aqui, cinza ali).
 */
export function StatusChip({ label, tone, size = 'small' }: Props) {
  return (
    <Chip
      label={label}
      size={size}
      color={tone === 'default' ? 'default' : tone}
      variant={tone === 'default' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 600 }}
    />
  );
}

export const CUSTOMER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
};

export const PRODUCT_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
};

export const USER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  INVITED: 'warning',
};

export const STOCK_LEVEL_TONE: Record<string, StatusTone> = {
  OK: 'success',
  LOW: 'warning',
  OUT: 'error',
  EXCESS: 'info',
};

export const MOVEMENT_TYPE_TONE: Record<string, StatusTone> = {
  IN: 'success',
  OUT: 'error',
  ADJUSTMENT: 'info',
};
