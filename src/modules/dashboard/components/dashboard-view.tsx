'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { alpha } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';

import { ChartCard } from '@/components/chart-card';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';
import { Link, useRouter } from '@/i18n/navigation';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';
import { getDashboardOverview } from '../actions';
import type { DashboardOverview, DashboardPeriod } from '../types';

const MOVEMENT_ICON: Record<string, string> = {
  IN: 'mdi:arrow-down-bold',
  OUT: 'mdi:arrow-up-bold',
  ADJUSTMENT: 'mdi:tune-variant',
};

const MOVEMENT_COLOR: Record<string, 'success' | 'error' | 'info'> = {
  IN: 'success',
  OUT: 'error',
  ADJUSTMENT: 'info',
};

// Paleta do donut derivada do tema, não das cores padrão do @mui/x-charts —
// senão o gráfico destoa do resto da interface e muda de cara entre claro e
// escuro.
const DONUT_COLORS = [
  'var(--mui-palette-primary-main)',
  'var(--mui-palette-warning-main)',
  'var(--mui-palette-info-dark)',
  'var(--mui-palette-success-main)',
  'var(--mui-palette-secondary-main)',
  'var(--mui-palette-error-main)',
];

export function DashboardView() {
  const t = useTranslations('Dashboard');
  const tNav = useTranslations('Nav');
  const tInventory = useTranslations('Inventory');
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { can } = useAccess();

  const [period, setPeriod] = useState<DashboardPeriod>('30d');

  const othersLabel = t('charts.others');

  const params = useMemo(
    () => ({ period, locale, othersLabel }),
    [period, locale, othersLabel]
  );

  /**
   * O resultado guarda junto os parâmetros que o pediram: `isLoading` vira
   * derivação e uma resposta fora de ordem não sobrescreve a atual.
   */
  const [loaded, setLoaded] = useState<{
    params: typeof params;
    data: DashboardOverview | null;
  } | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await getDashboardOverview(params.period, params.locale, params.othersLabel);

      if (active) {
        setLoaded({ params, data: result.ok ? result.data : null });
      }
    })();

    return () => {
      active = false;
    };
  }, [params]);

  const data = loaded?.data ?? null;
  const isLoading = loaded?.params !== params;

  const kpis = data?.kpis;
  const hasFlow = Boolean(data?.flow.some((point) => point.in > 0 || point.out > 0));
  const hasTopProducts = Boolean(data?.topProducts.length);
  const hasCategories = Boolean(data?.categories.length);

  const periodToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={period}
      onChange={(_event, value: DashboardPeriod | null) => value && setPeriod(value)}
    >
      <ToggleButton value="7d">{t('period.7d')}</ToggleButton>
      <ToggleButton value="30d">{t('period.30d')}</ToggleButton>
      <ToggleButton value="12m">{t('period.12m')}</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto', width: 1 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('greeting', { name: user?.firstName ?? '' })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('subtitle')}
        </Typography>
      </Stack>

      {!isLoading && kpis && kpis.lowStockCount > 0 && can('inventory.view') && (
        <Alert
          severity="warning"
          icon={<Icon icon="mdi:alert-outline" width={22} height={22} />}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => router.push('/dashboard/inventory?level=LOW')}
            >
              {t('lowStockAlert.action')}
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t('lowStockAlert.title', { count: kpis.lowStockCount })}
          </Typography>
          <Typography variant="caption">{t('lowStockAlert.description')}</Typography>
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label={t('kpi.customers')}
          value={kpis ? formatNumber(kpis.activeCustomers, locale, 0) : '—'}
          icon="mdi:account-group-outline"
          color="primary"
          trend={kpis?.activeCustomersTrend}
          trendLabel={t('kpi.vsLastMonth')}
          href={can('customers.view') ? '/dashboard/customers' : undefined}
          loading={isLoading}
        />
        <StatCard
          label={t('kpi.products')}
          value={kpis ? formatNumber(kpis.catalogProducts, locale, 0) : '—'}
          icon="mdi:package-variant-closed"
          color="info"
          trend={kpis?.catalogProductsTrend}
          trendLabel={t('kpi.vsLastMonth')}
          href={can('products.view') ? '/dashboard/products' : undefined}
          loading={isLoading}
        />
        <StatCard
          label={t('kpi.lowStock')}
          value={kpis ? formatNumber(kpis.lowStockCount, locale, 0) : '—'}
          icon="mdi:alert-outline"
          color="warning"
          href={can('inventory.view') ? '/dashboard/inventory?level=LOW' : undefined}
          loading={isLoading}
        />
        <StatCard
          label={t('kpi.stockValue')}
          value={kpis ? formatCurrency(kpis.stockValue, locale) : '—'}
          icon="mdi:cash-multiple"
          color="success"
          href={can('inventory.view') ? '/dashboard/inventory' : undefined}
          loading={isLoading}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        }}
      >
        <ChartCard
          title={t('charts.movements')}
          subtitle={t('charts.movementsSubtitle')}
          action={periodToggle}
          loading={isLoading}
          empty={!hasFlow}
          emptyLabel={t('charts.empty')}
          emptyIcon="mdi:chart-bar"
          height={320}
        >
          {data && (
            <BarChart
              height={320}
              xAxis={[{ scaleType: 'band', data: data.flow.map((point) => point.label) }]}
              series={[
                {
                  data: data.flow.map((point) => point.in),
                  label: t('charts.in'),
                  color: 'var(--mui-palette-success-main)',
                },
                {
                  data: data.flow.map((point) => point.out),
                  label: t('charts.out'),
                  color: 'var(--mui-palette-error-main)',
                },
              ]}
              margin={{ left: 8, right: 8, top: 24, bottom: 8 }}
            />
          )}
        </ChartCard>

        <ChartCard
          title={t('charts.stockByCategory')}
          subtitle={t('charts.stockByCategorySubtitle')}
          loading={isLoading}
          empty={!hasCategories}
          emptyLabel={t('charts.empty')}
          emptyIcon="mdi:chart-donut"
          height={320}
        >
          {data && (
            <PieChart
              height={320}
              colors={DONUT_COLORS}
              series={[
                {
                  innerRadius: 60,
                  paddingAngle: 2,
                  cornerRadius: 4,
                  data: data.categories.map((slice, index) => ({
                    id: index,
                    value: slice.quantity,
                    label: slice.name,
                  })),
                },
              ]}
              margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
            />
          )}
        </ChartCard>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <ChartCard
          title={t('charts.topProducts')}
          subtitle={t('charts.topProductsSubtitle')}
          loading={isLoading}
          empty={!hasTopProducts}
          emptyLabel={t('charts.empty')}
          emptyIcon="mdi:chart-bar"
          height={300}
        >
          {data && (
            <BarChart
              height={300}
              layout="horizontal"
              yAxis={[
                {
                  scaleType: 'band',
                  data: data.topProducts.map((point) => point.name),
                  // Nome de produto é longo; sem largura reservada o eixo
                  // corta tudo em "Furad…" e o gráfico perde a informação.
                  width: 150,
                  tickLabelStyle: { fontSize: 12 },
                },
              ]}
              series={[
                {
                  data: data.topProducts.map((point) => point.quantity),
                  color: 'var(--mui-palette-primary-main)',
                },
              ]}
              margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
            />
          )}
        </ChartCard>

        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
          <Stack spacing={2} sx={{ height: 1 }}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('recentActivity.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('recentActivity.subtitle')}
              </Typography>
            </Stack>

            {isLoading ? (
              <Stack spacing={1.5}>
                {Array.from({ length: 5 }).map((_item, index) => (
                  <Stack key={index} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Stack sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="35%" />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            ) : data && data.activity.length > 0 ? (
              <List disablePadding>
                {data.activity.map((item) => {
                  const color = MOVEMENT_COLOR[item.type] ?? 'info';

                  return (
                    <ListItem key={item.id} disableGutters sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            color: `${color}.main`,
                            bgcolor: (theme) => alpha(theme.palette[color].main, 0.14),
                          }}
                        >
                          <Icon icon={MOVEMENT_ICON[item.type]} width={18} height={18} />
                        </Avatar>
                      </ListItemAvatar>

                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {item.productName}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {tInventory(`type.${item.type}`)} ·{' '}
                            {formatNumber(Math.abs(item.quantity), locale)} {item.unit} ·{' '}
                            {formatDateTime(item.createdAt, locale)}
                            {item.userName ? ` · ${item.userName}` : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <Stack sx={{ flex: 1, justifyContent: 'center' }}>
                <EmptyState
                  icon="mdi:history"
                  title={t('recentActivity.empty')}
                  size="compact"
                  action={
                    can('inventory.create') ? (
                      <Button component={Link} href="/dashboard/inventory" variant="outlined" size="small">
                        {tNav('inventory')}
                      </Button>
                    ) : undefined
                  }
                />
              </Stack>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
