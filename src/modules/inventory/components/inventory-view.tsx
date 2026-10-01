'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import type { GridColDef } from '@mui/x-data-grid';

import { ChartCard } from '@/components/chart-card';
import { DataTable, type FilterChip } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { MOVEMENT_TYPE_TONE, STOCK_LEVEL_TONE, StatusChip } from '@/components/status-chip';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { downloadCsv } from '@/utils/csv';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format';
import {
  exportStockBalance,
  getInventoryKpis,
  getMovementFlow,
  listMovements,
  listStockBalance,
} from '../actions';
import { useMovements } from '../hooks/use-movements';
import { useStockBalance } from '../hooks/use-stock-balance';
import type {
  InventoryKpis,
  MovementFlowPoint,
  MovementRow,
  MovementType,
  ProductOption,
  StockBalanceRow,
  StockLevel,
} from '../types';
import { MovementFormDrawer } from './movement-form-drawer';

type Period = '7d' | '30d' | '12m';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '12m': 365 };

const STOCK_LEVELS: StockLevel[] = ['OK', 'LOW', 'OUT', 'EXCESS'];
const MOVEMENT_TYPES: MovementType[] = ['IN', 'OUT', 'ADJUSTMENT'];

/** Quantos itens em falta cabem no painel de alerta antes de virar lista. */
const LOW_STOCK_PREVIEW = 5;

function toProductOption(row: StockBalanceRow): ProductOption {
  return { id: row.productId, name: row.name, sku: row.sku, unit: row.unit };
}

export function InventoryView() {
  const t = useTranslations('Inventory');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tDashboard = useTranslations('Dashboard');
  const locale = useLocale();
  const { can } = useAccess();
  const { enqueueSnackbar } = useSnackbar();

  const balance = useStockBalance();
  const movements = useMovements();

  const [tab, setTab] = useState<'balance' | 'movements'>('balance');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preselected, setPreselected] = useState<ProductOption | null>(null);
  const [preselectedType, setPreselectedType] = useState<MovementType>('IN');

  /**
   * Cada bloco assíncrono guarda junto a chave que o pediu. Com isso o
   * `isLoading` correspondente vira derivação — nada de setState em tempo de
   * efeito — e uma resposta que chega atrasada não sobrescreve a atual.
   */
  const [summary, setSummary] = useState<{
    token: number;
    kpis: InventoryKpis | null;
    lowStockRows: StockBalanceRow[];
    lowStockTotal: number;
  } | null>(null);
  const [summaryToken, setSummaryToken] = useState(0);

  const [period, setPeriod] = useState<Period>('30d');
  /** Um lançamento novo precisa redesenhar o gráfico sem trocar o período. */
  const [flowNonce, setFlowNonce] = useState(0);
  const [loadedFlow, setLoadedFlow] = useState<{
    period: Period;
    nonce: number;
    points: MovementFlowPoint[];
  } | null>(null);

  const [historyProduct, setHistoryProduct] = useState<StockBalanceRow | null>(null);
  const [loadedHistory, setLoadedHistory] = useState<{
    product: StockBalanceRow;
    rows: MovementRow[];
  } | null>(null);

  const canCreate = can('inventory.create');
  const canExport = can('inventory.export');

  useEffect(() => {
    let active = true;

    void (async () => {
      const [kpisResult, lowStockResult] = await Promise.all([
        getInventoryKpis(),
        listStockBalance({ lowStock: true, page: 0, pageSize: LOW_STOCK_PREVIEW }),
      ]);

      if (!active) {
        return;
      }

      if (!kpisResult.ok) {
        enqueueSnackbar(tErrors(kpisResult.error), { variant: 'error' });
      }

      // A prévia de estoque baixo só é trocada quando vem resposta boa: um
      // erro ali não apaga a lista que o usuário já está vendo.
      setSummary((current) => ({
        token: summaryToken,
        kpis: kpisResult.ok ? kpisResult.data : null,
        lowStockRows: lowStockResult.ok ? lowStockResult.data.rows : (current?.lowStockRows ?? []),
        lowStockTotal: lowStockResult.ok ? lowStockResult.data.total : (current?.lowStockTotal ?? 0),
      }));
    })();

    return () => {
      active = false;
    };
  }, [summaryToken, enqueueSnackbar, tErrors]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await getMovementFlow(PERIOD_DAYS[period]);

      if (active) {
        setLoadedFlow({ period, nonce: flowNonce, points: result.ok ? result.data : [] });
      }
    })();

    return () => {
      active = false;
    };
  }, [period, flowNonce]);

  // O painel lateral só carrega quando um produto é escolhido — abrir o
  // histórico de todo mundo junto não serviria para nada.
  useEffect(() => {
    if (!historyProduct) {
      return;
    }

    let active = true;

    void (async () => {
      const result = await listMovements({
        productId: historyProduct.productId,
        page: 0,
        pageSize: 50,
      });

      if (active) {
        setLoadedHistory({ product: historyProduct, rows: result.ok ? result.data.rows : [] });
      }
    })();

    return () => {
      active = false;
    };
  }, [historyProduct]);

  const kpis = summary?.kpis ?? null;
  const lowStockRows = summary?.lowStockRows ?? [];
  const lowStockTotal = summary?.lowStockTotal ?? 0;
  const isKpisLoading = summary?.token !== summaryToken;

  const flow = useMemo(() => loadedFlow?.points ?? [], [loadedFlow]);
  const isFlowLoading =
    loadedFlow === null || loadedFlow.period !== period || loadedFlow.nonce !== flowNonce;

  const history = loadedHistory?.rows ?? [];
  const isHistoryLoading = historyProduct !== null && loadedHistory?.product !== historyProduct;

  const refreshAll = useCallback(() => {
    balance.refresh();
    movements.refresh();
    setSummaryToken((current) => current + 1);
    setFlowNonce((current) => current + 1);
  }, [balance, movements]);

  const openCreate = (product: ProductOption | null, type: MovementType = 'IN') => {
    setPreselected(product);
    setPreselectedType(type);
    setDrawerOpen(true);
  };

  const handleExport = async () => {
    const result = await exportStockBalance(balance.params);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    downloadCsv<StockBalanceRow>(
      `estoque-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: t('fields.product'), value: (row) => row.name },
        { header: t('fields.sku'), value: (row) => row.sku },
        { header: t('fields.category'), value: (row) => row.categoryName ?? '' },
        { header: t('fields.unit'), value: (row) => row.unit },
        { header: t('fields.quantity'), value: (row) => formatNumber(row.quantity, locale) },
        { header: t('fields.minStock'), value: (row) => formatNumber(row.minStock, locale) },
        {
          header: t('fields.maxStock'),
          value: (row) => (row.maxStock === null ? '' : formatNumber(row.maxStock, locale)),
        },
        { header: t('fields.level'), value: (row) => t(`level.${row.level}`) },
      ],
      result.data
    );
  };

  const balanceColumns = useMemo<GridColDef<StockBalanceRow>[]>(
    () => [
      {
        field: 'name',
        headerName: t('fields.product'),
        flex: 1.5,
        minWidth: 220,
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
        valueFormatter: (value: string | null) => value ?? tCommon('none'),
      },
      {
        field: 'quantity',
        headerName: t('fields.quantity'),
        width: 140,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatNumber(params.row.quantity, locale)} {params.row.unit}
          </Typography>
        ),
      },
      {
        field: 'minStock',
        headerName: t('fields.minStock'),
        width: 110,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value: number) => formatNumber(value, locale),
      },
      {
        field: 'level',
        headerName: t('fields.level'),
        width: 130,
        renderCell: (params) => (
          <StatusChip
            label={t(`level.${params.row.level}`)}
            tone={STOCK_LEVEL_TONE[params.row.level] ?? 'default'}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 60,
        sortable: false,
        hideable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Tooltip title={canCreate ? t('newMovement') : tCommon('noPermission')}>
            <span>
              <IconButton
                size="small"
                disabled={!canCreate}
                onClick={(event) => {
                  event.stopPropagation();
                  openCreate(toProductOption(params.row), 'IN');
                }}
              >
                <Icon icon="mdi:plus-box-outline" width={18} height={18} />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ],
    [t, tCommon, locale, canCreate]
  );

  const movementColumns = useMemo<GridColDef<MovementRow>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: t('fields.date'),
        width: 150,
        valueFormatter: (value: string) => formatDateTime(value, locale),
      },
      {
        field: 'productName',
        headerName: t('fields.product'),
        flex: 1.4,
        minWidth: 200,
        hideable: false,
        sortable: false,
        renderCell: (params) => (
          <Stack sx={{ justifyContent: 'center', height: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {params.row.productName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {params.row.sku}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'type',
        headerName: t('fields.type'),
        width: 120,
        renderCell: (params) => (
          <StatusChip
            label={t(`type.${params.row.type}`)}
            tone={MOVEMENT_TYPE_TONE[params.row.type] ?? 'default'}
          />
        ),
      },
      {
        field: 'quantity',
        headerName: t('fields.quantity'),
        width: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
            color={params.row.type === 'OUT' ? 'error.main' : 'success.main'}
          >
            {params.row.type === 'OUT' ? '−' : '+'}
            {formatNumber(Math.abs(params.row.quantity), locale)}
          </Typography>
        ),
      },
      {
        field: 'reason',
        headerName: t('fields.reason'),
        flex: 1,
        minWidth: 160,
        sortable: false,
        valueFormatter: (value: string | null) => value ?? tCommon('none'),
      },
      {
        field: 'reference',
        headerName: t('fields.reference'),
        width: 140,
        sortable: false,
        valueFormatter: (value: string | null) => value ?? tCommon('none'),
      },
      {
        field: 'userName',
        headerName: t('fields.user'),
        width: 160,
        sortable: false,
        valueFormatter: (value: string | null) => value ?? tCommon('none'),
      },
    ],
    [t, tCommon, locale]
  );

  const balanceFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    if (balance.categoryId !== 'ALL') {
      const category = balance.categories.find((item) => item.id === balance.categoryId);

      chips.push({
        key: 'category',
        label: `${t('fields.category')}: ${category?.name ?? balance.categoryId}`,
        onRemove: () => balance.onCategoryChange('ALL'),
      });
    }

    if (balance.level !== 'ALL') {
      chips.push({
        key: 'level',
        label: `${t('filters.level')}: ${t(`level.${balance.level}`)}`,
        onRemove: () => balance.onLevelChange('ALL'),
      });
    }

    if (balance.lowStock) {
      chips.push({
        key: 'lowStock',
        label: t('filters.lowStock'),
        onRemove: () => balance.onLowStockChange(false),
      });
    }

    return chips;
  }, [balance, t]);

  const movementFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    if (movements.type !== 'ALL') {
      chips.push({
        key: 'type',
        label: `${t('filters.type')}: ${t(`type.${movements.type}`)}`,
        onRemove: () => movements.onTypeChange('ALL'),
      });
    }

    if (movements.dateFrom) {
      chips.push({
        key: 'dateFrom',
        label: formatDate(movements.dateFrom, locale),
        onRemove: () => movements.onDateFromChange(''),
      });
    }

    if (movements.dateTo) {
      chips.push({
        key: 'dateTo',
        label: formatDate(movements.dateTo, locale),
        onRemove: () => movements.onDateToChange(''),
      });
    }

    return chips;
  }, [movements, t, locale]);

  const flowLabels = useMemo(() => {
    const options: Intl.DateTimeFormatOptions =
      period === '12m'
        ? { month: 'short', year: '2-digit' }
        : { day: '2-digit', month: '2-digit' };
    const formatter = new Intl.DateTimeFormat(locale, options);

    // O bucket vem como data pura; sem a hora explícita o `Date` assume UTC e
    // o rótulo pode cair um dia antes em fusos negativos.
    return flow.map((point) => formatter.format(new Date(`${point.date}T00:00:00`)));
  }, [flow, period, locale]);

  const hasFlowData = flow.some((point) => point.in > 0 || point.out > 0);

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto', width: 1 }}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        breadcrumbs={[{ label: tCommon('overview'), href: '/dashboard' }, { label: t('title') }]}
        action={
          <>
            {canExport && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleExport}
                startIcon={<Icon icon="mdi:download-outline" width={20} height={20} />}
              >
                {tCommon('export')}
              </Button>
            )}

            <Tooltip title={canCreate ? '' : tCommon('noPermission')}>
              <span>
                <Button
                  variant="contained"
                  disabled={!canCreate}
                  onClick={() => openCreate(null)}
                  startIcon={<Icon icon="mdi:plus" width={20} height={20} />}
                >
                  {t('newMovement')}
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label={t('kpi.skus')}
          value={kpis ? formatNumber(kpis.activeSkus, locale, 0) : '—'}
          icon="mdi:package-variant-closed"
          loading={isKpisLoading}
        />
        <StatCard
          label={t('kpi.lowStock')}
          value={kpis ? formatNumber(kpis.lowStock, locale, 0) : '—'}
          icon="mdi:alert-outline"
          color="warning"
          loading={isKpisLoading}
        />
        <StatCard
          label={t('kpi.outOfStock')}
          value={kpis ? formatNumber(kpis.outOfStock, locale, 0) : '—'}
          icon="mdi:package-variant-remove"
          color="error"
          loading={isKpisLoading}
        />
        <StatCard
          label={t('kpi.stockValue')}
          value={kpis ? formatCurrency(kpis.stockValue, locale) : '—'}
          icon="mdi:cash-multiple"
          color="success"
          loading={isKpisLoading}
        />
      </Box>

      {isKpisLoading ? (
        <Skeleton variant="rounded" height={96} />
      ) : (
        lowStockTotal > 0 && (
          <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t('lowStockAlert.title', { count: lowStockTotal })}
            </AlertTitle>

            <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
              {lowStockRows.map((row) => (
                <Stack
                  key={row.id}
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}
                >
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatNumber(row.quantity, locale)} / {formatNumber(row.minStock, locale)}{' '}
                      {row.unit}
                    </Typography>
                  </Stack>

                  <Tooltip title={canCreate ? '' : tCommon('noPermission')}>
                    <span>
                      <Button
                        size="small"
                        color="inherit"
                        disabled={!canCreate}
                        onClick={() => openCreate(toProductOption(row), 'IN')}
                      >
                        {t('lowStockAlert.action')}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Alert>
        )
      )}

      <ChartCard
        title={t('charts.flow')}
        subtitle={t('charts.flowSubtitle')}
        loading={isFlowLoading}
        empty={!hasFlowData}
        emptyLabel={t('charts.empty')}
        emptyIcon="mdi:chart-bar"
        height={280}
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={period}
            onChange={(_event, value: Period | null) => {
              if (value) {
                setPeriod(value);
              }
            }}
          >
            {(['7d', '30d', '12m'] as const).map((option) => (
              <ToggleButton key={option} value={option}>
                {tDashboard(`period.${option}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      >
        <BarChart
          height={280}
          xAxis={[{ scaleType: 'band', data: flowLabels }]}
          series={[
            {
              data: flow.map((point) => point.in),
              label: tDashboard('charts.in'),
              color: 'var(--mui-palette-success-main)',
            },
            {
              data: flow.map((point) => point.out),
              label: tDashboard('charts.out'),
              color: 'var(--mui-palette-error-main)',
            },
          ]}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        />
      </ChartCard>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_event, value: 'balance' | 'movements') => setTab(value)}>
          <Tab value="balance" label={t('tabs.balance')} />
          <Tab value="movements" label={t('tabs.movements')} />
        </Tabs>
      </Paper>

      {tab === 'balance' ? (
        <DataTable<StockBalanceRow>
          rows={balance.rows}
          columns={balanceColumns}
          rowCount={balance.total}
          loading={balance.isLoading}
          search={balance.search}
          onSearchChange={balance.onSearchChange}
          searchPlaceholder={t('searchPlaceholder')}
          paginationModel={balance.paginationModel}
          onPaginationModelChange={balance.setPaginationModel}
          sortModel={balance.sortModel}
          onSortModelChange={balance.setSortModel}
          activeFilters={balanceFilters}
          onClearFilters={balance.clearFilters}
          hasFiltersApplied={balanceFilters.length > 0 || Boolean(balance.search)}
          filters={
            <>
              <TextField
                select
                size="small"
                label={t('fields.category')}
                value={
                  balance.categories.some((item) => item.id === balance.categoryId)
                    ? balance.categoryId
                    : 'ALL'
                }
                onChange={(event) => balance.onCategoryChange(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="ALL">{tCommon('all')}</MenuItem>
                {balance.categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label={t('filters.level')}
                value={balance.level}
                onChange={(event) => balance.onLevelChange(event.target.value as StockLevel | 'ALL')}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="ALL">{tCommon('all')}</MenuItem>
                {STOCK_LEVELS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {t(`level.${option}`)}
                  </MenuItem>
                ))}
              </TextField>

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={balance.lowStock}
                    onChange={(event) => balance.onLowStockChange(event.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t('filters.lowStock')}</Typography>}
              />
            </>
          }
          onRowClick={(id) => {
            const row = balance.rows.find((item) => item.id === id);

            if (row) {
              setHistoryProduct(row);
            }
          }}
          emptyTitle={t('empty')}
          emptyDescription={t('emptyDescription')}
          emptyIcon="mdi:package-variant-closed"
        />
      ) : (
        <DataTable<MovementRow>
          rows={movements.rows}
          columns={movementColumns}
          rowCount={movements.total}
          loading={movements.isLoading}
          search={movements.search}
          onSearchChange={movements.onSearchChange}
          searchPlaceholder={t('searchPlaceholder')}
          paginationModel={movements.paginationModel}
          onPaginationModelChange={movements.setPaginationModel}
          sortModel={movements.sortModel}
          onSortModelChange={movements.setSortModel}
          activeFilters={movementFilters}
          onClearFilters={movements.clearFilters}
          hasFiltersApplied={movementFilters.length > 0 || Boolean(movements.search)}
          filters={
            <>
              <TextField
                select
                size="small"
                label={t('filters.type')}
                value={movements.type}
                onChange={(event) =>
                  movements.onTypeChange(event.target.value as MovementType | 'ALL')
                }
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="ALL">{tCommon('all')}</MenuItem>
                {MOVEMENT_TYPES.map((option) => (
                  <MenuItem key={option} value={option}>
                    {t(`type.${option}`)}
                  </MenuItem>
                ))}
              </TextField>

              {/* Par de datas sob um rótulo só: não há chave para "até" e
                  duplicar "Data" nos dois campos confundiria mais que ajudar. */}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  type="date"
                  size="small"
                  label={t('fields.date')}
                  value={movements.dateFrom}
                  onChange={(event) => movements.onDateFromChange(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: 150 }}
                />

                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>

                <TextField
                  type="date"
                  size="small"
                  value={movements.dateTo}
                  onChange={(event) => movements.onDateToChange(event.target.value)}
                  slotProps={{ htmlInput: { 'aria-label': t('fields.date') } }}
                  sx={{ minWidth: 150 }}
                />
              </Stack>
            </>
          }
          emptyTitle={t('emptyMovements')}
          emptyDescription={t('emptyMovementsDescription')}
          emptyIcon="mdi:swap-vertical"
          emptyAction={
            canCreate ? (
              <Button variant="contained" onClick={() => openCreate(null)}>
                {t('newMovement')}
              </Button>
            ) : undefined
          }
        />
      )}

      <Drawer
        anchor="right"
        open={Boolean(historyProduct)}
        onClose={() => setHistoryProduct(null)}
        slotProps={{ paper: { sx: { width: { xs: 1, sm: 460 } } } }}
      >
        <Stack sx={{ height: 1 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'flex-start', justifyContent: 'space-between', px: 3, py: 2.5 }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                {historyProduct?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('charts.productHistory')}
              </Typography>
            </Stack>

            <IconButton
              size="small"
              onClick={() => setHistoryProduct(null)}
              aria-label={tCommon('close')}
            >
              <Icon icon="mdi:close" width={20} height={20} />
            </IconButton>
          </Stack>

          <Divider />

          {historyProduct && (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2 }}
            >
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('fields.quantity')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatNumber(historyProduct.quantity, locale)} {historyProduct.unit}
                </Typography>
              </Stack>

              <StatusChip
                label={t(`level.${historyProduct.level}`)}
                tone={STOCK_LEVEL_TONE[historyProduct.level] ?? 'default'}
              />
            </Stack>
          )}

          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
            {isHistoryLoading ? (
              <Stack spacing={1.5}>
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} variant="rounded" height={56} />
                ))}
              </Stack>
            ) : history.length === 0 ? (
              <EmptyState
                icon="mdi:swap-vertical"
                title={t('emptyMovements')}
                description={t('emptyMovementsDescription')}
                size="compact"
              />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {history.map((movement) => (
                  <Stack
                    key={movement.id}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'flex-start', justifyContent: 'space-between', py: 1.5 }}
                  >
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                      <StatusChip
                        label={t(`type.${movement.type}`)}
                        tone={MOVEMENT_TYPE_TONE[movement.type] ?? 'default'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(movement.createdAt, locale)}
                        {movement.userName ? ` · ${movement.userName}` : ''}
                      </Typography>
                      {movement.reason && (
                        <Typography variant="body2" color="text.secondary">
                          {movement.reason}
                        </Typography>
                      )}
                    </Stack>

                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      color={movement.type === 'OUT' ? 'error.main' : 'success.main'}
                    >
                      {movement.type === 'OUT' ? '−' : '+'}
                      {formatNumber(Math.abs(movement.quantity), locale)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          <Stack sx={{ px: 3, py: 2 }}>
            <Tooltip title={canCreate ? '' : tCommon('noPermission')}>
              <span>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={!canCreate}
                  onClick={() =>
                    historyProduct && openCreate(toProductOption(historyProduct), 'IN')
                  }
                >
                  {t('newMovement')}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Drawer>

      <MovementFormDrawer
        open={drawerOpen}
        product={preselected}
        defaultType={preselectedType}
        onClose={() => setDrawerOpen(false)}
        onSaved={refreshAll}
      />
    </Stack>
  );
}
