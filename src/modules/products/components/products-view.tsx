'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { GridColDef } from '@mui/x-data-grid';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type FilterChip } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PRODUCT_STATUS_TONE, STOCK_LEVEL_TONE, StatusChip } from '@/components/status-chip';
import { useRouter } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { downloadCsv } from '@/utils/csv';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';
import {
  deleteProduct,
  exportProducts,
  getProduct,
  restoreProduct,
  setProductsStatus,
} from '../actions';
import { useProducts } from '../hooks/use-products';
import type { ProductDetail, ProductListItem } from '../types';
import { ProductFormDrawer } from './product-form-drawer';

/** Progresso do saldo contra o mínimo (ou o máximo, quando não há mínimo). */
function stockProgress(row: ProductListItem): number {
  const reference = row.minStock > 0 ? row.minStock : row.maxStock ?? 0;

  if (reference <= 0) {
    return row.stock > 0 ? 100 : 0;
  }

  return Math.max(0, Math.min(100, (row.stock / reference) * 100));
}

export function ProductsView() {
  const t = useTranslations('Products');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tStock = useTranslations('Inventory');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAccess();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const list = useProducts();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDetail | null>(null);
  const [deleting, setDeleting] = useState<ProductListItem | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeletingBusy, setIsDeletingBusy] = useState(false);

  const canCreate = can('products.create');
  const canEdit = can('products.edit');
  const canDelete = can('products.delete');
  const canExport = can('products.export');

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = async (id: string) => {
    const result = await getProduct(id);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    setEditing(result.data);
    setDrawerOpen(true);
  };

  const openDelete = (row: ProductListItem) => {
    setForceDelete(false);
    setDeleting(row);
  };

  const closeDelete = () => {
    setForceDelete(false);
    setDeleting(null);
  };

  const handleDelete = async () => {
    if (!deleting) {
      return;
    }

    setIsDeletingBusy(true);

    try {
      const result = await deleteProduct(deleting.id, forceDelete);

      if (!result.ok) {
        // O saldo em estoque não é um erro de verdade, é um alerta: o diálogo
        // passa a mostrar o aviso e a próxima confirmação exclui mesmo assim.
        if (result.error === 'hasStock') {
          setForceDelete(true);
          return;
        }

        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        return;
      }

      const deletedId = deleting.id;
      closeDelete();
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
              const undo = await restoreProduct(deletedId);

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
    const result = await setProductsStatus(selectedIds, status);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('toast.statusChanged'), { variant: 'success' });
    setSelectedIds([]);
    void list.refresh();
  };

  const handleExport = async () => {
    const result = await exportProducts(list.params, selectedIds);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    downloadCsv<ProductListItem>(
      `produtos-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: t('fields.sku'), value: (row) => row.sku },
        { header: t('fields.name'), value: (row) => row.name },
        { header: t('fields.category'), value: (row) => row.categoryName ?? t('noCategory') },
        { header: t('fields.unit'), value: (row) => row.unit },
        { header: t('fields.costPrice'), value: (row) => formatCurrency(row.costPrice, locale) },
        { header: t('fields.salePrice'), value: (row) => formatCurrency(row.salePrice, locale) },
        { header: t('fields.margin'), value: (row) => formatPercent(row.margin, locale) },
        { header: t('fields.stock'), value: (row) => formatNumber(row.stock, locale) },
        { header: t('fields.minStock'), value: (row) => formatNumber(row.minStock, locale) },
        {
          header: t('fields.maxStock'),
          value: (row) => (row.maxStock === null ? '' : formatNumber(row.maxStock, locale)),
        },
        { header: t('fields.status'), value: (row) => t(`status.${row.status}`) },
      ],
      result.data
    );
  };

  const columns = useMemo<GridColDef<ProductListItem>[]>(
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
              {params.row.sku}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'categoryName',
        headerName: t('fields.category'),
        flex: 0.9,
        minWidth: 150,
        valueFormatter: (value: string | null) => value ?? t('noCategory'),
      },
      {
        field: 'costPrice',
        headerName: t('fields.costPrice'),
        width: 130,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value: number) => formatCurrency(value, locale),
      },
      {
        field: 'salePrice',
        headerName: t('fields.salePrice'),
        width: 130,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value: number) => formatCurrency(value, locale),
      },
      {
        field: 'margin',
        headerName: t('fields.margin'),
        width: 100,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
            color={params.row.margin < 0 ? 'error.main' : 'text.primary'}
          >
            {formatPercent(params.row.margin, locale)}
          </Typography>
        ),
      },
      {
        field: 'stock',
        headerName: t('fields.stock'),
        flex: 1,
        minWidth: 190,
        renderCell: (params) => {
          const tone = STOCK_LEVEL_TONE[params.row.stockLevel] ?? 'default';

          return (
            <Stack spacing={0.75} sx={{ justifyContent: 'center', height: 1, width: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {formatNumber(params.row.stock, locale)} {params.row.unit}
                </Typography>
                <StatusChip
                  label={tStock(`level.${params.row.stockLevel}`)}
                  tone={tone}
                />
              </Stack>

              <LinearProgress
                variant="determinate"
                value={stockProgress(params.row)}
                color={tone === 'default' ? 'inherit' : tone}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Stack>
          );
        },
      },
      {
        field: 'status',
        headerName: t('fields.status'),
        width: 110,
        renderCell: (params) => (
          <StatusChip
            label={t(`status.${params.row.status}`)}
            tone={PRODUCT_STATUS_TONE[params.row.status] ?? 'default'}
          />
        ),
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
                    openDelete(params.row);
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
    [t, tCommon, tStock, locale, canEdit, canDelete]
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

    if (list.categoryId !== 'ALL') {
      const name =
        list.categoryId === 'NONE'
          ? t('noCategory')
          : list.categories.find((item) => item.id === list.categoryId)?.name ?? list.categoryId;

      chips.push({
        key: 'category',
        label: `${t('filters.category')}: ${name}`,
        onRemove: () => list.onCategoryChange('ALL'),
      });
    }

    if (list.lowStock) {
      chips.push({
        key: 'lowStock',
        label: t('filters.lowStock'),
        onRemove: () => list.onLowStockChange(false),
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

      <DataTable<ProductListItem>
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
              label={t('filters.category')}
              value={
                list.categoryId === 'ALL' ||
                list.categoryId === 'NONE' ||
                list.categories.some((item) => item.id === list.categoryId)
                  ? list.categoryId
                  : 'ALL'
              }
              onChange={(event) => list.onCategoryChange(event.target.value)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="ALL">{tCommon('all')}</MenuItem>
              <MenuItem value="NONE">{t('noCategory')}</MenuItem>
              {list.categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>

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

            <Chip
              label={t('filters.lowStock')}
              icon={<Icon icon="mdi:alert-outline" width={16} height={16} />}
              color={list.lowStock ? 'warning' : 'default'}
              variant={list.lowStock ? 'filled' : 'outlined'}
              onClick={() => list.onLowStockChange(!list.lowStock)}
              sx={{ alignSelf: 'center', fontWeight: 600 }}
            />
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
        onRowClick={(id) => router.push(`/dashboard/products/${id}`)}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyDescription')}
        emptyIcon="mdi:package-variant-closed"
        emptyAction={
          canCreate ? (
            <Button variant="contained" onClick={openCreate}>
              {t('new')}
            </Button>
          ) : undefined
        }
      />

      <ProductFormDrawer
        open={drawerOpen}
        product={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={list.refresh}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('delete.title')}
        description={
          <>
            {t.rich('delete.description', {
              name: deleting?.name ?? '',
              strong: (chunks) => <strong>{chunks}</strong>,
            })}

            {forceDelete && (
              <Box
                component="span"
                sx={{ display: 'block', mt: 1.5, color: 'warning.main', fontWeight: 600 }}
              >
                {t('delete.withStockWarning', {
                  quantity: `${formatNumber(deleting?.stock ?? 0, locale)} ${deleting?.unit ?? ''}`,
                })}
              </Box>
            )}
          </>
        }
        confirmLabel={t('delete.confirm')}
        loading={isDeletingBusy}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </Stack>
  );
}
