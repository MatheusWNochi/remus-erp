'use server';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { requirePermission } from '@/lib/server/session';
import { getStockBalances, resolveStockLevel } from '@/lib/server/stock';
import { toNumber } from '@/utils/format';
import type {
  ActivityItem,
  CategorySlice,
  DashboardKpis,
  DashboardOverview,
  DashboardPeriod,
  MovementFlowPoint,
  TopProductPoint,
} from '../types';

const PERIOD_DAYS: Record<DashboardPeriod, number> = { '7d': 7, '30d': 30, '12m': 365 };

function startOfPeriod(period: DashboardPeriod): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - PERIOD_DAYS[period]);

  return date;
}

/** Divisão protegida: sem base de comparação, não existe variação a mostrar. */
function trend(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return (current - previous) / previous;
}

async function buildKpis(enterpriseId: string): Promise<DashboardKpis> {
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [activeCustomers, customersMonthAgo, catalogProducts, productsMonthAgo, products] =
    await Promise.all([
      prisma.customer.count({ where: { enterpriseId, deletedAt: null, status: 'ACTIVE' } }),
      // Quantos já existiam há 30 dias: ignora quem foi criado depois e
      // reinclui quem só foi excluído depois daquela data.
      prisma.customer.count({
        where: {
          enterpriseId,
          status: 'ACTIVE',
          createdAt: { lt: monthAgo },
          OR: [{ deletedAt: null }, { deletedAt: { gt: monthAgo } }],
        },
      }),
      prisma.product.count({ where: { enterpriseId, deletedAt: null, status: 'ACTIVE' } }),
      prisma.product.count({
        where: {
          enterpriseId,
          status: 'ACTIVE',
          createdAt: { lt: monthAgo },
          OR: [{ deletedAt: null }, { deletedAt: { gt: monthAgo } }],
        },
      }),
      prisma.product.findMany({
        where: { enterpriseId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, minStock: true, maxStock: true, costPrice: true },
      }),
    ]);

  const balances = await getStockBalances(enterpriseId);

  let lowStockCount = 0;
  let stockValue = 0;

  for (const product of products) {
    const quantity = balances.get(product.id) ?? 0;
    const level = resolveStockLevel(
      quantity,
      toNumber(product.minStock),
      product.maxStock === null ? null : toNumber(product.maxStock)
    );

    if (level === 'LOW' || level === 'OUT') {
      lowStockCount += 1;
    }

    stockValue += quantity * toNumber(product.costPrice);
  }

  return {
    activeCustomers,
    activeCustomersTrend: trend(activeCustomers, customersMonthAgo),
    catalogProducts,
    catalogProductsTrend: trend(catalogProducts, productsMonthAgo),
    lowStockCount,
    stockValue,
  };
}

async function buildFlow(
  enterpriseId: string,
  period: DashboardPeriod,
  locale: string
): Promise<MovementFlowPoint[]> {
  const since = startOfPeriod(period);
  const byMonth = period === '12m';

  const movements = await prisma.stockMovement.findMany({
    where: { enterpriseId, createdAt: { gte: since } },
    select: { type: true, quantity: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map<string, MovementFlowPoint>();
  const formatter = new Intl.DateTimeFormat(locale,
    byMonth ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' }
  );

  // Pré-popula o período inteiro para que dias sem movimento apareçam como
  // zero no gráfico, em vez de encurtar a linha.
  const cursor = new Date(since);
  const now = new Date();

  while (cursor <= now) {
    const key = byMonth
      ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      : cursor.toISOString().slice(0, 10);

    if (!buckets.has(key)) {
      buckets.set(key, { bucket: key, label: formatter.format(cursor), in: 0, out: 0 });
    }

    if (byMonth) {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const movement of movements) {
    const key = byMonth
      ? `${movement.createdAt.getFullYear()}-${String(movement.createdAt.getMonth() + 1).padStart(2, '0')}`
      : movement.createdAt.toISOString().slice(0, 10);

    const point =
      buckets.get(key) ??
      ({ bucket: key, label: formatter.format(movement.createdAt), in: 0, out: 0 } as MovementFlowPoint);

    const quantity = toNumber(movement.quantity);

    if (movement.type === 'OUT') {
      point.out += quantity;
    } else if (movement.type === 'IN') {
      point.in += quantity;
    } else {
      // Ajuste entra do lado que representa o efeito no saldo.
      if (quantity >= 0) {
        point.in += quantity;
      } else {
        point.out += Math.abs(quantity);
      }
    }

    buckets.set(key, point);
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

async function buildTopProducts(
  enterpriseId: string,
  period: DashboardPeriod
): Promise<TopProductPoint[]> {
  const since = startOfPeriod(period);

  const grouped = await prisma.stockMovement.groupBy({
    by: ['productId'],
    where: { enterpriseId, createdAt: { gte: since } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  if (grouped.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((row) => row.productId) } },
    select: { id: true, name: true },
  });

  const names = new Map(products.map((product) => [product.id, product.name]));

  return grouped.map((row) => ({
    productId: row.productId,
    name: names.get(row.productId) ?? '—',
    quantity: Math.abs(toNumber(row._sum.quantity)),
  }));
}

async function buildCategories(enterpriseId: string, othersLabel: string): Promise<CategorySlice[]> {
  const products = await prisma.product.findMany({
    where: { enterpriseId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, category: { select: { name: true } } },
  });

  const balances = await getStockBalances(enterpriseId);
  const totals = new Map<string, number>();

  for (const product of products) {
    const quantity = balances.get(product.id) ?? 0;

    if (quantity <= 0) {
      continue;
    }

    const name = product.category?.name ?? othersLabel;
    totals.set(name, (totals.get(name) ?? 0) + quantity);
  }

  const sorted = Array.from(totals, ([name, quantity]) => ({ name, quantity })).sort(
    (a, b) => b.quantity - a.quantity
  );

  // Donut com muitas fatias vira sopa de cores: mantém as 5 maiores e
  // agrupa o resto.
  if (sorted.length <= 6) {
    return sorted;
  }

  const head = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((sum, slice) => sum + slice.quantity, 0);

  return [...head, { name: othersLabel, quantity: rest }];
}

async function buildActivity(enterpriseId: string): Promise<ActivityItem[]> {
  const movements = await prisma.stockMovement.findMany({
    where: { enterpriseId },
    select: {
      id: true,
      type: true,
      quantity: true,
      reason: true,
      createdAt: true,
      createdBy: true,
      product: { select: { id: true, name: true, unit: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  const userIds = Array.from(
    new Set(movements.map((movement) => movement.createdBy).filter((id): id is string => Boolean(id)))
  );

  const users = userIds.length
    ? await prisma.authUser.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  const names = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));

  return movements.map((movement) => ({
    id: movement.id,
    productId: movement.product.id,
    productName: movement.product.name,
    type: movement.type,
    quantity: toNumber(movement.quantity),
    unit: movement.product.unit,
    reason: movement.reason,
    createdAt: movement.createdAt.toISOString(),
    userName: movement.createdBy ? names.get(movement.createdBy) ?? null : null,
  }));
}

export async function getDashboardOverview(
  period: DashboardPeriod,
  locale: string,
  othersLabel: string
): Promise<ActionResult<DashboardOverview>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('dashboard.view');

    const [kpis, flow, topProducts, categories, activity] = await Promise.all([
      buildKpis(enterpriseId),
      buildFlow(enterpriseId, period, locale),
      buildTopProducts(enterpriseId, period),
      buildCategories(enterpriseId, othersLabel),
      buildActivity(enterpriseId),
    ]);

    return { kpis, flow, topProducts, categories, activity };
  });
}
