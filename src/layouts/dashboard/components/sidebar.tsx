'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { alpha, useTheme } from '@mui/material';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Link, usePathname } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { useSettings } from '@/modules/settings/hooks/use-settings';
import { navItems } from '../config-nav';

const WIDTH_EXPANDED = 220;
const WIDTH_COLLAPSED = 80;

export function Sidebar() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { palette } = useTheme();
  const { sidebarCollapsed, setSidebarCollapsed } = useSettings();
  const { can } = useAccess();

  const width = sidebarCollapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED;

  // Mesma regra da navbar: sem permissão, o item nem aparece.
  const visibleItems = navItems.filter((item) => can(item.permission));

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create('width'),
        '& .MuiDrawer-paper': {
          width,
          overflowX: 'hidden',
          boxSizing: 'border-box',
          bgcolor: 'background.default',
          borderRight: '1px solid',
          borderColor: alpha(palette.divider, 0.5),
          transition: (theme) => theme.transitions.create('width'),
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          px: sidebarCollapsed ? 0 : 3,
          py: 2.5,
        }}
      >
        {!sidebarCollapsed && (
          <Typography variant="subtitle1" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            Remus ERP
          </Typography>
        )}
        <IconButton
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          size="small"
          aria-label={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
        >
          <Icon
            icon={sidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'}
            width={22}
            height={22}
          />
        </IconButton>
      </Stack>

      <List sx={{ px: sidebarCollapsed ? 1 : 1.5 }}>
        {visibleItems.map((item) => {
          const selected = pathname === item.path;
          const icon = (
            <>
              <ListItemIcon sx={{ minWidth: sidebarCollapsed ? 0 : 36, justifyContent: 'center' }}>
                <Icon icon={item.icon} width={26} height={26} />
              </ListItemIcon>
              {!sidebarCollapsed && <ListItemText primary={t(item.key)} />}
            </>
          );

          const buttonSx = {
            borderRadius: 1.5,
            mb: 0.5,
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            px: sidebarCollapsed ? 1.5 : 2,
          } as const;

          const tooltipTitle = item.comingSoon ? t('comingSoon') : sidebarCollapsed ? t(item.key) : '';

          if (item.comingSoon) {
            return (
              <Tooltip key={item.key} title={tooltipTitle} placement="right">
                <span>
                  <ListItemButton disabled sx={{ ...buttonSx, color: 'text.primary' }}>
                    {icon}
                  </ListItemButton>
                </span>
              </Tooltip>
            );
          }

          return (
            <Tooltip key={item.key} title={tooltipTitle} placement="right">
              <ListItemButton component={Link} href={item.path} selected={selected} sx={buttonSx}>
                {icon}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Drawer>
  );
}
