'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Link, usePathname } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { navItems } from '../config-nav';
import { EnterpriseSwitcher } from './enterprise-switcher';
import { UserAvatar } from './user-avatar';

type Props = {
  showNavLinks: boolean;
  onOpenSettings: () => void;
  onOpenUser: () => void;
};

export function Navbar({ showNavLinks, onOpenSettings, onOpenUser }: Props) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { user } = useAuth();
  const { can } = useAccess();

  // Esconder o que o usuário não pode abrir é melhor do que deixar o link
  // visível e devolver "sem permissão" depois do clique.
  const visibleItems = navItems.filter((item) => can(item.permission));

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        bgcolor: 'background',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mr: 2 }}>
          Remus ERP
        </Typography>

        {showNavLinks && (
          <Stack direction="row" spacing={0.5} sx={{ flex: 1, overflowX: 'auto' }}>
            {visibleItems.map((item) => {
              const buttonSx = {
                borderRadius: 1.5,
                px: 1.5,
                gap: 1,
                color: 'text.primary',
                bgcolor: pathname === item.path ? 'action.selected' : 'transparent',
              } as const;

              const label = (
                <>
                  <Icon icon={item.icon} width={26} height={26} />
                  <Typography variant="body1" sx={{ display: { xs: 'none', md: 'inline' } }}>
                    {t(item.key)}
                  </Typography>
                </>
              );

              return (
                <Tooltip key={item.key} title={item.comingSoon ? t('comingSoon') : ''}>
                  <span>
                    {item.comingSoon ? (
                      <IconButton disabled sx={buttonSx}>
                        {label}
                      </IconButton>
                    ) : (
                      <IconButton component={Link} href={item.path} sx={buttonSx}>
                        {label}
                      </IconButton>
                    )}
                  </span>
                </Tooltip>
              );
            })}
          </Stack>
        )}

        {!showNavLinks && <Stack sx={{ flex: 1 }} />}

        <EnterpriseSwitcher />

        <IconButton onClick={onOpenSettings} aria-label={t('settings')}>
          <Icon icon="mdi:cog-outline" width={26} height={26} />
        </IconButton>

        <Tooltip title={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}>
          <IconButton onClick={onOpenUser} sx={{ ml: 0.5 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              color="success"
            >
              <UserAvatar firstName={user?.firstName} lastName={user?.lastName} sx={{ width: 34, height: 34 }} />
            </Badge>
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
