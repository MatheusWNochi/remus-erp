'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { SettingsDrawer } from '@/modules/settings/components/settings-drawer';
import { useSettings } from '@/modules/settings/hooks/use-settings';
import { Navbar } from './components/navbar';
import { Sidebar } from './components/sidebar';
import { UserDrawer } from './components/user-drawer';

type Props = {
  children: React.ReactNode;
};

export function DashboardLayout({ children }: Props) {
  const { navPosition } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const isSideNav = navPosition === 'side';

  return (
    <Stack direction="row" sx={{ minHeight: '100vh', width: 1 }}>
      {isSideNav && <Sidebar />}

      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Navbar
          showNavLinks={!isSideNav}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenUser={() => setUserOpen(true)}
        />

        <Box component="main" sx={{ flex: 1, bgcolor: 'background.default' }}>
          {children}
        </Box>
      </Stack>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UserDrawer open={userOpen} onClose={() => setUserOpen(false)} />
    </Stack>
  );
}
