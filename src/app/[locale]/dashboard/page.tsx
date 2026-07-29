'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useAuth } from '@/modules/auth/hooks/use-auth';
import { navItems } from '@/layouts/dashboard/config-nav';

export default function AppHomePage() {
  const t = useTranslations('Dashboard');
  const tNav = useTranslations('Nav');
  const { user } = useAuth();

  const modules = navItems.filter((item) => item.key !== 'dashboard');

  return (
    <Stack spacing={4} sx={{ px: { xs: 3, md: 6 }, py: 5, maxWidth: 1080, mx: 'auto' }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('greeting', { name: user?.firstName ?? '' })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('subtitle')}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        {modules.map((item) => (
          <Paper
            key={item.key}
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              opacity: item.comingSoon ? 0.6 : 1,
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Icon icon={item.icon} width={28} height={28} />
              {item.comingSoon && <Chip label={tNav('comingSoon')} size="small" />}
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {tNav(item.key)}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
