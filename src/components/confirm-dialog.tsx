'use client';

import { useTranslations } from 'next-intl';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

type Props = {
  open: boolean;
  title: string;
  /** Deve nomear a entidade: "Excluir cliente Acme Ltda?" */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'error' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  severity = 'error',
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const t = useTranslations('Common');

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>

      <DialogContent>
        <DialogContentText component="div" variant="body2">
          {description}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          {cancelLabel ?? t('cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={severity} loading={loading}>
          {confirmLabel ?? t('confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
