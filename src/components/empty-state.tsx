'use client';

import { Icon } from '@iconify/react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `compact` para usar dentro de um card; `page` para a área principal. */
  size?: 'compact' | 'page';
};

export function EmptyState({ icon = 'mdi:inbox-outline', title, description, action, size = 'page' }: Props) {
  const isCompact = size === 'compact';

  return (
    <Stack
      spacing={isCompact ? 1.5 : 2}
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: isCompact ? 4 : 8,
        px: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: isCompact ? 56 : 80,
          height: isCompact ? 56 : 80,
          borderRadius: '50%',
          color: 'text.secondary',
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        }}
      >
        <Icon icon={icon} width={isCompact ? 28 : 40} height={isCompact ? 28 : 40} />
      </Box>

      <Stack spacing={0.5} sx={{ maxWidth: 420 }}>
        <Typography variant={isCompact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Stack>

      {action}
    </Stack>
  );
}
