'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';

import { ChartCard } from '@/components/chart-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PRODUCT_STATUS_TONE, STOCK_LEVEL_TONE, StatusChip } from '@/components/status-chip';
import { useRouter } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '@/utils/format';
import { deleteProduct, getProduct, getProductMovements, setProductsStatus } from '../actions';
import type { ProductDetail, ProductMovementPoint } from '../types';
import { ProductFormDrawer } from './product-form-drawer';

const PERIODS = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

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

export function ProductDetailView({ productId }: { productId: string }) {
  const t = useTranslations('Products');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const tStock = useTranslations('Inventory');
  const tDashboard = useTranslations('Dashboard');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAccess();
  const { enqueueSnackbar } = useSnackbar();

  /**
   * O produto carregado guarda junto a chave que o pediu (id + recarga), então
   * `isLoading` é derivado e nenhuma resposta atrasada sobrescreve a atual.
   */
  const [loaded, setLoaded] = useState<{
    productId: string;
    token: number;
    product: ProductDetail | null;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [loadedChart, setLoadedChart] = useState<{
    productId: string;
    period: PeriodKey;
    points: ProductMovementPoint[];
  } | null>(null);

  const canEdit = can('products.edit');
  const canDelete = can('products.delete');

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await getProduct(productId);

      if (active) {
        setLoaded({ productId, token: reloadToken, product: result.ok ? result.data : null });
      }
    })();

    return () => {
      active = false;
    };
  }, [productId, reloadToken]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const days = PERIODS.find((item) => item.key === period)?.days ?? 30;
      const result = await getProductMovements(productId, days);

      if (active) {
        setLoadedChart({ productId, period, points: result.ok ? result.data : [] });
      }
    })();

    return () => {
      active = false;
    };
  }, [productId, period]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const product = loaded?.product ?? null;
  const isLoading =
    loaded === null || loaded.productId !== productId || loaded.token !== reloadToken;

  const movements = useMemo(() => loadedChart?.points ?? [], [loadedChart]);
  const isChartLoading =
    loadedChart === null || loadedChart.productId !== productId || loadedChart.period !== period;

  const chart = useMemo(
    () => ({
      labels: movements.map((point) => formatDate(point.date, locale)),
      incoming: movements.map((point) => point.in),
      outgoing: movements.map((point) => point.out),
      isEmpty: movements.every((point) => point.in === 0 && point.out === 0),
    }),
    [movements, locale]
  );

  const toggleStatus = async () => {
    if (!product) {
      return;
    }

    const next = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await setProductsStatus([product.id], next);

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('toast.statusChanged'), { variant: 'success' });
    reload();
  };

  const handleDelete = async () => {
    if (!product) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await deleteProduct(product.id, forceDelete);

      if (!result.ok) {
        // Saldo em estoque não impede: só exige uma segunda confirmação, com
        // o aviso visível no próprio diálogo.
        if (result.error === 'hasStock') {
          setForceDelete(true);
          return;
        }

        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        return;
      }

      enqueueSnackbar(t('toast.deleted'), { variant: 'success' });
      router.push('/dashboard/products');
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!product) {
    return (
      <Stack sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
        <EmptyState
          icon="mdi:package-variant-remove"
          title={t('notFound')}
          action={
            <Button variant="contained" onClick={() => router.push('/dashboard/products')}>
              {tCommon('back')}
            </Button>
          }
        />
      </Stack>
    );
  }

  const stockTone = STOCK_LEVEL_TONE[product.stockLevel] ?? 'default';
  const stockReference = product.minStock > 0 ? product.minStock : product.maxStock ?? 0;
  const stockProgress =
    stockReference > 0
      ? Math.max(0, Math.min(100, (product.stock / stockReference) * 100))
      : product.stock > 0
        ? 100
        : 0;

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1200, mx: 'auto', width: 1 }}>
      <PageHeader
        title={product.name}
        description={product.sku}
        breadcrumbs={[
          { label: tCommon('overview'), href: '/dashboard' },
          { label: t('title'), href: '/dashboard/products' },
          { label: product.name },
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
                  {product.status === 'ACTIVE' ? tCommon('deactivate') : tCommon('activate')}
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={canDelete ? tCommon('delete') : tCommon('noPermission')}>
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={!canDelete}
                  onClick={() => {
                    setForceDelete(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Icon icon="mdi:trash-can-outline" width={18} height={18} />
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <StatusChip
          label={t(`status.${product.status}`)}
          tone={PRODUCT_STATUS_TONE[product.status] ?? 'default'}
        />
        <StatusChip label={tStock(`level.${product.stockLevel}`)} tone={stockTone} />
        <Typography variant="caption" color="text.secondary">
          {tCommon('createdAt')} {formatDate(product.createdAt, locale)} · {tCommon('updatedAt')}{' '}
          {formatDateTime(product.updatedAt, locale)}
        </Typography>
      </Stack>

      <Section title={t('sections.identification')}>
        <Field label={t('fields.name')} value={product.name} />
        <Field label={t('fields.sku')} value={product.sku} />
        <Field label={t('fields.category')} value={product.categoryName ?? t('noCategory')} />
        <Field label={t('fields.unit')} value={product.unit} />
      </Section>

      <Section title={t('sections.pricing')}>
        <Field label={t('fields.costPrice')} value={formatCurrency(product.costPrice, locale)} />
        <Field label={t('fields.salePrice')} value={formatCurrency(product.salePrice, locale)} />
        <Field label={t('fields.margin')} value={formatPercent(product.margin, locale)} />
      </Section>

      <Section title={t('sections.stock')}>
        <Field
          label={t('fields.stock')}
          value={`${formatNumber(product.stock, locale)} ${product.unit}`}
        />
        <Field label={t('fields.minStock')} value={formatNumber(product.minStock, locale)} />
        <Field
          label={t('fields.maxStock')}
          value={product.maxStock === null ? '' : formatNumber(product.maxStock, locale)}
        />

        <Box sx={{ gridColumn: '1 / -1' }}>
          <LinearProgress
            variant="determinate"
            value={stockProgress}
            color={stockTone === 'default' ? 'inherit' : stockTone}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </Section>

      <ChartCard
        title={tStock('charts.productHistory')}
        subtitle={tStock('charts.flowSubtitle')}
        loading={isChartLoading}
        empty={chart.isEmpty}
        emptyLabel={tStock('charts.empty')}
        emptyIcon="mdi:chart-bar"
        height={280}
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={period}
            onChange={(_event, value: PeriodKey | null) => value && setPeriod(value)}
          >
            {PERIODS.map((item) => (
              <ToggleButton key={item.key} value={item.key}>
                {tDashboard(`period.${item.key}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      >
        <BarChart
          height={280}
          xAxis={[{ data: chart.labels, scaleType: 'band' }]}
          series={[
            {
              data: chart.incoming,
              label: tDashboard('charts.in'),
              // Cor vem do tema: hex fixo quebraria no modo escuro.
              color: 'var(--mui-palette-success-main)',
            },
            {
              data: chart.outgoing,
              label: tDashboard('charts.out'),
              color: 'var(--mui-palette-error-main)',
            },
          ]}
          grid={{ horizontal: true }}
        />
      </ChartCard>

      {product.description && (
        <Section title={t('sections.extra')}>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {product.description}
            </Typography>
          </Box>
        </Section>
      )}

      <ProductFormDrawer
        open={drawerOpen}
        product={product}
        onClose={() => setDrawerOpen(false)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('delete.title')}
        description={
          <>
            {t.rich('delete.description', {
              name: product.name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}

            {forceDelete && (
              <Box
                component="span"
                sx={{ display: 'block', mt: 1.5, color: 'warning.main', fontWeight: 600 }}
              >
                {t('delete.withStockWarning', {
                  quantity: `${formatNumber(product.stock, locale)} ${product.unit}`,
                })}
              </Box>
            )}
          </>
        }
        confirmLabel={t('delete.confirm')}
        loading={isBusy}
        onConfirm={handleDelete}
        onClose={() => {
          setForceDelete(false);
          setConfirmDelete(false);
        }}
      />
    </Stack>
  );
}
