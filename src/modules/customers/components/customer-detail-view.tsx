'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { CUSTOMER_STATUS_TONE, StatusChip } from '@/components/status-chip';
import { useRouter } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { formatDate, formatDateTime, formatDocument, formatPhone, formatZipCode } from '@/utils/format';
import { deleteCustomer, getCustomer, setCustomersStatus } from '../actions';
import type { CustomerDetail } from '../types';
import { CustomerFormDrawer } from './customer-form-drawer';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
      <Stack spacing={2.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Divider />
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {children}
        </Box>
      </Stack>
    </Paper>
  );
}

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAccess();
  const { enqueueSnackbar } = useSnackbar();

  /**
   * O cliente carregado guarda junto a chave que o pediu (id + recarga), então
   * `isLoading` é derivado e nenhuma resposta atrasada sobrescreve a atual.
   */
  const [loaded, setLoaded] = useState<{
    customerId: string;
    token: number;
    customer: CustomerDetail | null;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const canEdit = can('customers.edit');
  const canDelete = can('customers.delete');

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await getCustomer(customerId);

      if (active) {
        setLoaded({ customerId, token: reloadToken, customer: result.ok ? result.data : null });
      }
    })();

    return () => {
      active = false;
    };
  }, [customerId, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const customer = loaded?.customer ?? null;
  const isLoading =
    loaded === null || loaded.customerId !== customerId || loaded.token !== reloadToken;

  const toggleStatus = async () => {
    if (!customer) {
      return;
    }

    const next = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await setCustomersStatus([customer.id], next);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('toast.statusChanged'), { variant: 'success' });
    reload();
  };

  const handleDelete = async () => {
    if (!customer) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await deleteCustomer(customer.id);

      if (!result.ok) {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        return;
      }

      enqueueSnackbar(t('toast.deleted'), { variant: 'success' });
      router.push('/dashboard/customers');
    } finally {
      setIsBusy(false);
      setConfirmDelete(false);
    }
  };

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!customer) {
    return (
      <Stack sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
        <EmptyState
          icon="mdi:account-off-outline"
          title={t('notFound')}
          action={
            <Button variant="contained" onClick={() => router.push('/dashboard/customers')}>
              {tCommon('back')}
            </Button>
          }
        />
      </Stack>
    );
  }

  const address = [
    customer.street,
    customer.number,
    customer.complement,
    customer.district,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1200, mx: 'auto', width: 1 }}>
      <PageHeader
        title={customer.name}
        description={formatDocument(customer.document)}
        breadcrumbs={[
          { label: tCommon('overview'), href: '/dashboard' },
          { label: t('title'), href: '/dashboard/customers' },
          { label: customer.name },
        ]}
        action={
          <>
            <Tooltip title={canEdit ? '' : tCommon('noPermission')}>
              <span>
                <Button
                  variant="contained"
                  disabled={!canEdit}
                  onClick={() => setDrawerOpen(true)}
                  startIcon={<Icon icon="mdi:pencil-outline" width={18} height={18} />}
                >
                  {tCommon('edit')}
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={canEdit ? '' : tCommon('noPermission')}>
              <span>
                <Button variant="outlined" color="inherit" disabled={!canEdit} onClick={toggleStatus}>
                  {customer.status === 'ACTIVE' ? tCommon('deactivate') : tCommon('activate')}
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={canDelete ? tCommon('delete') : tCommon('noPermission')}>
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={!canDelete}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon icon="mdi:trash-can-outline" width={18} height={18} />
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <StatusChip
          label={t(`status.${customer.status}`)}
          tone={CUSTOMER_STATUS_TONE[customer.status] ?? 'default'}
        />
        <Typography variant="caption" color="text.secondary">
          {tCommon('createdAt')} {formatDate(customer.createdAt, locale)} · {tCommon('updatedAt')}{' '}
          {formatDateTime(customer.updatedAt, locale)}
        </Typography>
      </Stack>

      <Section title={t('sections.identification')}>
        <Field label={t('fields.name')} value={customer.name} />
        <Field label={t('fields.personType')} value={t(`personType.${customer.personType}`)} />
        <Field label={t('fields.document')} value={formatDocument(customer.document)} />
      </Section>

      <Section title={t('sections.contact')}>
        <Field label={t('fields.email')} value={customer.email} />
        <Field label={t('fields.phone')} value={formatPhone(customer.phone)} />
      </Section>

      <Section title={t('sections.address')}>
        <Field label={t('fields.zipCode')} value={formatZipCode(customer.zipCode)} />
        <Field label={t('fields.street')} value={address} />
        <Field
          label={t('fields.location')}
          value={[customer.city, customer.state].filter(Boolean).join(' / ')}
        />
      </Section>

      {customer.notes && (
        <Section title={t('sections.extra')}>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {customer.notes}
            </Typography>
          </Box>
        </Section>
      )}

      <CustomerFormDrawer
        open={drawerOpen}
        customer={customer}
        onClose={() => setDrawerOpen(false)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('delete.title')}
        description={t.rich('delete.description', {
          name: customer.name,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
        confirmLabel={t('delete.confirm')}
        loading={isBusy}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </Stack>
  );
}
