'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { GridColDef } from '@mui/x-data-grid';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type FilterChip } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { CUSTOMER_STATUS_TONE, StatusChip } from '@/components/status-chip';
import { useRouter } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { downloadCsv } from '@/utils/csv';
import { formatDate, formatDocument, formatPhone } from '@/utils/format';
import {
  deleteCustomer,
  exportCustomers,
  getCustomer,
  restoreCustomer,
  setCustomersStatus,
} from '../actions';
import { useCustomers } from '../hooks/use-customers';
import type { CustomerDetail, CustomerListItem } from '../types';
import { CustomerFormDrawer } from './customer-form-drawer';

export function CustomersView() {
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAccess();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const list = useCustomers();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDetail | null>(null);
  const [deleting, setDeleting] = useState<CustomerListItem | null>(null);
  const [isDeletingBusy, setIsDeletingBusy] = useState(false);

  const canCreate = can('customers.create');
  const canEdit = can('customers.edit');
  const canDelete = can('customers.delete');
  const canExport = can('customers.export');

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = async (id: string) => {
    const result = await getCustomer(id);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    setEditing(result.data);
    setDrawerOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) {
      return;
    }

    setIsDeletingBusy(true);

    try {
      const result = await deleteCustomer(deleting.id);

      if (!result.ok) {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        return;
      }

      const deletedId = deleting.id;
      setDeleting(null);
      void list.refresh();

      // Exclusão é soft delete, então dá para oferecer o desfazer de verdade
      // em vez de só avisar que sumiu.
      enqueueSnackbar(t('toast.deleted'), {
        variant: 'success',
        action: (key) => (
          <Button
            color="inherit"
            size="small"
            onClick={async () => {
              closeSnackbar(key);
              const undo = await restoreCustomer(deletedId);

              if (undo.ok) {
                enqueueSnackbar(t('toast.restored'), { variant: 'success' });
                void list.refresh();
              } else {
                enqueueSnackbar(tErrors(undo.error), { variant: 'error' });
              }
            }}
          >
            {tCommon('undo')}
          </Button>
        ),
      });
    } finally {
      setIsDeletingBusy(false);
    }
  };

  const handleBulkStatus = async (status: 'ACTIVE' | 'INACTIVE') => {
    const result = await setCustomersStatus(selectedIds, status);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('toast.statusChanged'), { variant: 'success' });
    setSelectedIds([]);
    void list.refresh();
  };

  const handleExport = async () => {
    const result = await exportCustomers(list.params, selectedIds);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    downloadCsv<CustomerListItem>(
      `clientes-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: t('fields.name'), value: (row) => row.name },
        { header: t('fields.personType'), value: (row) => t(`personType.${row.personType}`) },
        { header: t('fields.document'), value: (row) => formatDocument(row.document) },
        { header: t('fields.email'), value: (row) => row.email ?? '' },
        { header: t('fields.phone'), value: (row) => formatPhone(row.phone) },
        { header: t('fields.city'), value: (row) => row.city ?? '' },
        { header: t('fields.state'), value: (row) => row.state ?? '' },
        { header: t('fields.status'), value: (row) => t(`status.${row.status}`) },
        { header: tCommon('createdAt'), value: (row) => formatDate(row.createdAt, locale) },
      ],
      result.data
    );
  };

  const columns = useMemo<GridColDef<CustomerListItem>[]>(
    () => [
      {
        field: 'name',
        headerName: t('fields.name'),
        flex: 1.4,
        minWidth: 200,
        hideable: false,
        renderCell: (params) => (
          <Stack sx={{ justifyContent: 'center', height: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {params.row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t(`personType.${params.row.personType}`)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'document',
        headerName: t('fields.document'),
        flex: 0.9,
        minWidth: 150,
        valueFormatter: (value: string | null) => formatDocument(value),
      },
      {
        field: 'email',
        headerName: t('fields.email'),
        flex: 1.2,
        minWidth: 180,
        valueFormatter: (value: string | null) => value ?? '—',
      },
      {
        field: 'phone',
        headerName: t('fields.phone'),
        flex: 0.8,
        minWidth: 140,
        sortable: false,
        valueFormatter: (value: string | null) => formatPhone(value),
      },
      {
        field: 'city',
        headerName: t('fields.location'),
        flex: 0.8,
        minWidth: 140,
        valueGetter: (_value, row) =>
          row.city ? [row.city, row.state].filter(Boolean).join(' / ') : '—',
      },
      {
        field: 'status',
        headerName: t('fields.status'),
        width: 120,
        renderCell: (params) => (
          <StatusChip
            label={t(`status.${params.row.status}`)}
            tone={CUSTOMER_STATUS_TONE[params.row.status] ?? 'default'}
          />
        ),
      },
      {
        field: 'createdAt',
        headerName: tCommon('createdAt'),
        width: 120,
        valueFormatter: (value: string) => formatDate(value, locale),
      },
      {
        field: 'actions',
        headerName: '',
        width: 100,
        sortable: false,
        hideable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5} sx={{ height: 1, alignItems: 'center' }}>
            <Tooltip title={canEdit ? tCommon('edit') : tCommon('noPermission')}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canEdit}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openEdit(params.row.id);
                  }}
                >
                  <Icon icon="mdi:pencil-outline" width={18} height={18} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={canDelete ? tCommon('delete') : tCommon('noPermission')}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canDelete}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleting(params.row);
                  }}
                >
                  <Icon icon="mdi:trash-can-outline" width={18} height={18} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    // `openEdit` é estável o bastante para o escopo desta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tCommon, locale, canEdit, canDelete]
  );

  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    if (list.status !== 'ALL') {
      chips.push({
        key: 'status',
        label: `${t('filters.status')}: ${t(`status.${list.status}`)}`,
        onRemove: () => list.onStatusChange('ALL'),
      });
    }

    if (list.state !== 'ALL') {
      chips.push({
        key: 'state',
        label: `${t('filters.state')}: ${list.state}`,
        onRemove: () => list.onStateChange('ALL'),
      });
    }

    return chips;
  }, [list, t]);

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto', width: 1 }}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        breadcrumbs={[{ label: tCommon('overview'), href: '/dashboard' }, { label: t('title') }]}
        action={
          <Tooltip title={canCreate ? '' : tCommon('noPermission')}>
            <span>
              <Button
                variant="contained"
                disabled={!canCreate}
                onClick={openCreate}
                startIcon={<Icon icon="mdi:plus" width={20} height={20} />}
              >
                {t('new')}
              </Button>
            </span>
          </Tooltip>
        }
      />

      <DataTable<CustomerListItem>
        rows={list.rows}
        columns={columns}
        rowCount={list.total}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.onSearchChange}
        searchPlaceholder={t('searchPlaceholder')}
        paginationModel={list.paginationModel}
        onPaginationModelChange={list.setPaginationModel}
        sortModel={list.sortModel}
        onSortModelChange={list.setSortModel}
        activeFilters={activeFilters}
        onClearFilters={list.clearFilters}
        hasFiltersApplied={activeFilters.length > 0 || Boolean(list.search)}
        filters={
          <>
            <TextField
              select
              size="small"
              label={t('filters.status')}
              value={list.status}
              onChange={(event) =>
                list.onStatusChange(event.target.value as 'ACTIVE' | 'INACTIVE' | 'ALL')
              }
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="ALL">{tCommon('all')}</MenuItem>
              <MenuItem value="ACTIVE">{t('status.ACTIVE')}</MenuItem>
              <MenuItem value="INACTIVE">{t('status.INACTIVE')}</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label={t('filters.state')}
              value={list.states.includes(list.state) ? list.state : 'ALL'}
              onChange={(event) => list.onStateChange(event.target.value)}
              sx={{ minWidth: 110 }}
            >
              <MenuItem value="ALL">{tCommon('all')}</MenuItem>
              {list.states.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
          </>
        }
        selectedIds={canEdit || canExport ? selectedIds : undefined}
        onSelectedIdsChange={canEdit || canExport ? setSelectedIds : undefined}
        bulkActions={() => (
          <>
            {canExport && (
              <Button
                size="small"
                color="inherit"
                onClick={handleExport}
                startIcon={<Icon icon="mdi:download-outline" width={18} height={18} />}
              >
                {tCommon('export')}
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="small" color="inherit" onClick={() => handleBulkStatus('ACTIVE')}>
                  {t('bulk.activate')}
                </Button>
                <Button size="small" color="inherit" onClick={() => handleBulkStatus('INACTIVE')}>
                  {t('bulk.deactivate')}
                </Button>
              </>
            )}
          </>
        )}
        onRowClick={(id) => router.push(`/dashboard/customers/${id}`)}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyDescription')}
        emptyIcon="mdi:account-group-outline"
        emptyAction={
          canCreate ? (
            <Button variant="contained" onClick={openCreate}>
              {t('new')}
            </Button>
          ) : undefined
        }
      />

      <CustomerFormDrawer
        open={drawerOpen}
        customer={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={list.refresh}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('delete.title')}
        description={t.rich('delete.description', {
          name: deleting?.name ?? '',
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
        confirmLabel={t('delete.confirm')}
        loading={isDeletingBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  );
}
