'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Chip from '@mui/material/Chip';

import { useAccess } from '@/modules/auth/hooks/use-access';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { UserAvatar } from './user-avatar';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UserDrawer({ open, onClose }: Props) {
  const t = useTranslations('UserMenu');
  const tNav = useTranslations('Nav');
  const { user, signOut } = useAuth();
  const { access } = useAccess();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
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

        <Stack spacing={2} sx={{ alignItems: 'center', px: 3, py: 4 }}>
          <UserAvatar firstName={user?.firstName} lastName={user?.lastName} sx={{ width: 64, height: 64, fontSize: 22 }} />
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {access?.isDeveloper && (
              <Chip label={t('developer')} size="small" color="secondary" sx={{ fontWeight: 600 }} />
            )}
            {access?.enterpriseName && (
              <Chip
                label={`${tNav('enterprise')}: ${access.enterpriseName}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack sx={{ px: 3, py: 3 }}>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            loading={signingOut}
            startIcon={<Icon icon="mdi:logout" width={18} height={18} />}
            onClick={handleSignOut}
          >
            {t('signOut')}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
