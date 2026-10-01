'use client';

import { Icon } from '@iconify/react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Link } from '@/i18n/navigation';

type Color = 'primary' | 'success' | 'warning' | 'error' | 'info';

type Props = {
  label: string;
  value: string | number;
  icon: string;
  color?: Color;
  /** Variação vs. período anterior, em fração (0.12 = +12%). */
  trend?: number | null;
  trendLabel?: string;
  /** Torna o card clicável, levando à lista que origina o número. */
  href?: string;
  loading?: boolean;
};

export function StatCard({
  label,
  value,
  icon,
  color = 'primary',
  trend,
  trendLabel,
  href,
  loading = false,
}: Props) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const isUp = hasTrend && trend > 0;
  const isFlat = hasTrend && trend === 0;

  const content = (
    <Stack spacing={1.5} sx={{ p: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 1.5,
            color: `${color}.main`,
            bgcolor: (theme) => alpha(theme.palette[color].main, 0.14),
          }}
        >
          <Icon icon={icon} width={20} height={20} />
        </Box>
      </Stack>

      {loading ? (
        <Skeleton variant="text" width={96} height={40} />
      ) : (
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}

      {loading ? (
        <Skeleton variant="text" width={120} />
      ) : (
        hasTrend && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Icon
              icon={isFlat ? 'mdi:minus' : isUp ? 'mdi:trending-up' : 'mdi:trending-down'}
              width={18}
              height={18}
              color={
                isFlat ? undefined : isUp ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-error-main)'
              }
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600 }}
              color={isFlat ? 'text.secondary' : isUp ? 'success.main' : 'error.main'}
            >
              {new Intl.NumberFormat(undefined, {
                style: 'percent',
                maximumFractionDigits: 1,
                signDisplay: 'exceptZero',
              }).format(trend)}
            </Typography>
            {trendLabel && (
              <Typography variant="caption" color="text.secondary">
                {trendLabel}
              </Typography>
            )}
          </Stack>
        )
      )}
    </Stack>
  );

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {href ? (
        <CardActionArea component={Link} href={href} sx={{ height: 1 }}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Paper>
  );
}
