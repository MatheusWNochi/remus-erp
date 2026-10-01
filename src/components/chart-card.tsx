'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmptyState } from './empty-state';

type Props = {
  title: string;
  subtitle?: string;
  /** Normalmente um ToggleButtonGroup de período (7d/30d/12m). */
  action?: React.ReactNode;
  loading?: boolean;
  /** Quando `true`, mostra o estado vazio no lugar do gráfico. */
  empty?: boolean;
  emptyLabel?: string;
  emptyIcon?: string;
  height?: number;
  children: React.ReactNode;
};

export function ChartCard({
  title,
  subtitle,
  action,
  loading = false,
  empty = false,
  emptyLabel,
  emptyIcon = 'mdi:chart-line',
  height = 300,
  children,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, height: 1 }}>
      <Stack spacing={2.5} sx={{ height: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
          {action}
        </Stack>

        <Box sx={{ flex: 1, minHeight: height, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Skeleton variant="rounded" sx={{ flex: 1, minHeight: height }} />
          ) : empty ? (
            <Stack sx={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState icon={emptyIcon} title={emptyLabel ?? ''} size="compact" />
            </Stack>
          ) : (
            children
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
