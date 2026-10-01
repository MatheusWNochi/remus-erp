'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  submitLabel?: string;
  submitting?: boolean;
  /** Desabilita o envio sem esconder o botão (ex: formulário inválido). */
  disabled?: boolean;
  width?: number;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
};

export function FormDrawer({
  open,
  title,
  subtitle,
  submitLabel,
  submitting = false,
  disabled = false,
  width = 460,
  onClose,
  onSubmit,
  children,
}: Props) {
  const t = useTranslations('Common');

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={submitting ? undefined : onClose}
      slotProps={{ paper: { sx: { width: { xs: 1, sm: width } } } }}
    >
      <Stack
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        sx={{ height: 1 }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between', px: 3, py: 2.5 }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>

          <IconButton onClick={onClose} disabled={submitting} size="small" aria-label={t('close')}>
            <Icon icon="mdi:close" width={20} height={20} />
          </IconButton>
        </Stack>

        <Divider />

        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>{children}</Box>

        <Divider />

        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            {t('cancel')}
          </Button>
          <Button type="submit" variant="contained" loading={submitting} disabled={disabled}>
            {submitLabel ?? t('save')}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
