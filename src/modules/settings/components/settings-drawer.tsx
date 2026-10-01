'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { useColorScheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useSettings } from '../hooks/use-settings';
import { NavPosition } from '../types';

const LOCALE_LABEL: Record<string, 'portuguese' | 'english'> = {
  pt: 'portuguese',
  en: 'english',
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDrawer({ open, onClose }: Props) {
  const t = useTranslations('Settings');
  const { mode, setMode } = useColorScheme();
  const { navPosition, setNavPosition } = useSettings();

  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isSwitchingLocale, startLocaleTransition] = useTransition();

  // O locale vive no caminho da URL, então trocar de idioma é navegar para a
  // mesma rota no outro locale — mantém a tela atual em vez de voltar à home.
  const changeLocale = (next: string) => {
    startLocaleTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 320 } } }}>
      <Stack sx={{ height: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('title')}
          </Typography>
          <IconButton onClick={onClose} aria-label={t('close')}>
            <Icon icon="mdi:close" width={20} height={20} />
          </IconButton>
        </Stack>

        <Divider />

        <Stack spacing={4} sx={{ px: 3, py: 4 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('theme')}
            </Typography>
            <ToggleButtonGroup
              value={mode ?? 'system'}
              exclusive
              fullWidth
              size="small"
              onChange={(_event, value) => {
                if (value) setMode(value);
              }}
            >
              <ToggleButton value="light">
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Icon icon="mdi:white-balance-sunny" width={20} height={20} />
                  <Typography variant="caption">{t('light')}</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="dark">
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Icon icon="mdi:moon-waning-crescent" width={20} height={20} />
                  <Typography variant="caption">{t('dark')}</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="system">
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Icon icon="mdi:monitor" width={20} height={20} />
                  <Typography variant="caption">{t('system')}</Typography>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('navPosition')}
            </Typography>
            <ToggleButtonGroup
              value={navPosition}
              exclusive
              fullWidth
              size="small"
              onChange={(_event, value: NavPosition | null) => {
                if (value) setNavPosition(value);
              }}
            >
              <ToggleButton value="top">
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Icon icon="mdi:dock-top" width={20} height={20} />
                  <Typography variant="caption">{t('navTop')}</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="side">
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Icon icon="mdi:dock-left" width={20} height={20} />
                  <Typography variant="caption">{t('navSide')}</Typography>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('language')}
            </Typography>
            <ToggleButtonGroup
              value={locale}
              exclusive
              fullWidth
              size="small"
              disabled={isSwitchingLocale}
              onChange={(_event, value: string | null) => {
                if (value && value !== locale) changeLocale(value);
              }}
            >
              {routing.locales.map((option) => (
                <ToggleButton key={option} value={option}>
                  <Typography variant="caption">{t(LOCALE_LABEL[option] ?? 'language')}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1 }} />
      </Stack>
    </Drawer>
  );
}
