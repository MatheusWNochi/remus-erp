'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { AppError, requirePermission } from '@/lib/server/session';
import { getStockBalance, getStockBalances, resolveStockLevel } from '@/lib/server/stock';
import { toNumber } from '@/utils/format';
import type { Prisma } from '@/generated/prisma/client';
import type {
  CategoryOption,
  InventoryKpis,
  MovementFlowPoint,
  MovementListParams,
  MovementListResult,
  MovementRow,
  ProductBalance,
  ProductOption,
  StockBalanceParams,
  StockBalanceResult,
  StockBalanceRow,
} from '../types';
import {
  movementFormSchema,
  movementListParamsSchema,
  stockBalanceParamsSchema,
  type MovementFormValues,
} from './schema';

/** Teto de produtos carregados por vez — o saldo é somado em memória. */
const MAX_PRODUCTS = 5000;

const BALANCE_SORTABLE_FIELDS = new Set(['name', 'sku', 'categoryName', 'quantity', 'minStock', 'level']);
const MOVEMENT_SORTABLE_FIELDS = new Set(['createdAt', 'quantity', 'type']);

/** Ordem de gravidade usada quando a listagem é ordenada por situação. */
const LEVEL_WEIGHT: Record<StockBalanceRow['level'], number> = {
  OUT: 0,
  LOW: 1,
  OK: 2,
  EXCESS: 3,
};

type BalanceInput = ReturnType<typeof stockBalanceParamsSchema.parse>;

function productWhere(enterpriseId: string, input: BalanceInput): Prisma.productWhereInput {
  return {
    enterpriseId,
    deletedAt: null,
    status: 'ACTIVE',
    ...(input.categoryId !== 'ALL' ? { categoryId: input.categoryId } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { sku: { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

/**
 * Monta as linhas de saldo já filtradas e ordenadas.
 *
 * Saldo é derivado de `stock_movement`, então não existe coluna para o
 * Postgres filtrar ou ordenar — tudo que depende da quantidade acontece aqui,
 * depois da soma. A paginação fica a cargo de quem chama.
 */
async function loadBalanceRows(
  enterpriseId: string,
  input: BalanceInput
): Promise<StockBalanceRow[]> {
  const products = await prisma.product.findMany({
    where: productWhere(enterpriseId, input),
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      minStock: true,
      maxStock: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
    take: MAX_PRODUCTS,
  });

  const balances = await getStockBalances(
    enterpriseId,
    products.map((product) => product.id)
  );

  let rows = products.map<StockBalanceRow>((product) => {
    const quantity = balances.get(product.id) ?? 0;
    const minStock = toNumber(product.minStock);
    const maxStock = product.maxStock === null ? null : toNumber(product.maxStock);

    return {
      id: product.id,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: product.category?.name ?? null,
      unit: product.unit,
      quantity,
      minStock,
      maxStock,
      level: resolveStockLevel(quantity, minStock, maxStock),
    };
  });

  if (input.lowStock) {
    rows = rows.filter((row) => row.level === 'LOW' || row.level === 'OUT');
  }

  if (input.level !== 'ALL') {
    rows = rows.filter((row) => row.level === input.level);
  }

  const sortField =
    input.sortField && BALANCE_SORTABLE_FIELDS.has(input.sortField) ? input.sortField : 'name';
  const direction = input.sortDirection === 'desc' ? -1 : 1;

  return rows.sort((a, b) => {
    switch (sortField) {
      case 'quantity':
        return (a.quantity - b.quantity) * direction;
      case 'minStock':
        return (a.minStock - b.minStock) * direction;
      case 'level':
        return (LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level]) * direction;
      case 'sku':
        return a.sku.localeCompare(b.sku) * direction;
      case 'categoryName':
        return (a.categoryName ?? '').localeCompare(b.categoryName ?? '') * direction;
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });
}

export async function listStockBalance(
  params: StockBalanceParams
): Promise<ActionResult<StockBalanceResult>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');
    const input = stockBalanceParamsSchema.parse(params);

    const [rows, categories] = await Promise.all([
      loadBalanceRows(enterpriseId, input),
      prisma.productCategory.findMany({
        where: { enterpriseId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const start = input.page * input.pageSize;

    return {
      rows: rows.slice(start, start + input.pageSize),
      total: rows.length,
      categories: categories satisfies CategoryOption[],
    };
  });
}

export async function listMovements(
  params: MovementListParams
): Promise<ActionResult<MovementListResult>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');
    const input = movementListParamsSchema.parse(params);

    const where: Prisma.stockMovementWhereInput = {
      enterpriseId,
      ...(input.productId !== 'ALL' ? { productId: input.productId } : {}),
      ...(input.type !== 'ALL' ? { type: input.type } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              // O filtro vem como data, então o limite superior precisa pegar
              // o dia inteiro, não o instante zero da madrugada.
              ...(input.dateTo ? { lte: new Date(`${input.dateTo.slice(0, 10)}T23:59:59.999`) } : {}),
            },
          }
        : {}),
      ...(input.search
        ? {
            product: {
              is: {
                OR: [
                  { name: { contains: input.search, mode: 'insensitive' } },
                  { sku: { contains: input.search, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };

    const sortField =
      input.sortField && MOVEMENT_SORTABLE_FIELDS.has(input.sortField)
        ? input.sortField
        : 'createdAt';
    const sortDirection = input.sortDirection ?? 'desc';

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        select: {
          id: true,
          productId: true,
          type: true,
          quantity: true,
          reason: true,
          reference: true,
          createdAt: true,
          createdBy: true,
          product: { select: { name: true, sku: true } },
        },
        orderBy: { [sortField]: sortDirection },
        skip: input.page * input.pageSize,
        take: input.pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // `stock_movement` não tem relação com `auth_user` no schema, então o
    // autor é resolvido num lookup à parte em vez de um join inventado.
    const authorIds = [
      ...new Set(
        movements.map((movement) => movement.createdBy).filter((id): id is string => Boolean(id))
      ),
    ];

    const authors = await prisma.authUser.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const authorNames = new Map(
      authors.map((author) => [author.id, `${author.firstName} ${author.lastName}`.trim()])
    );

    return {
      rows: movements.map<MovementRow>((movement) => ({
        id: movement.id,
        productId: movement.productId,
        productName: movement.product.name,
        sku: movement.product.sku,
        type: movement.type,
        quantity: toNumber(movement.quantity),
        reason: movement.reason,
        reference: movement.reference,
        createdAt: movement.createdAt.toISOString(),
        userName: movement.createdBy ? authorNames.get(movement.createdBy) ?? null : null,
      })),
      total,
    };
  });
}

/** Alimenta o Autocomplete do formulário de movimentação. */
export async function searchProducts(term: string): Promise<ActionResult<ProductOption[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');
    const search = term.trim();

    const products = await prisma.product.findMany({
      where: {
        enterpriseId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return products;
  });
}

/**
 * Saldo de um produto para o formulário mostrar o antes e o depois do
 * lançamento — a mesma conta que `createMovement` refaz no servidor.
 */
export async function getProductBalance(productId: string): Promise<ActionResult<ProductBalance>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');

    const product = await prisma.product.findFirst({
      where: { id: productId, enterpriseId, deletedAt: null },
      select: { id: true, name: true, sku: true, unit: true },
    });

    if (!product) {
      throw new AppError('notFound');
    }

    return { ...product, quantity: await getStockBalance(enterpriseId, product.id) };
  });
}

export async function createMovement(
  values: MovementFormValues
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('inventory.create');
    const data = movementFormSchema.parse(values);

    // Filtrar por enterprise aqui impede que um id de outro tenant vire uma
    // movimentação válida na empresa errada.
    const product = await prisma.product.findFirst({
      where: { id: data.productId, enterpriseId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError('notFound');
    }

    const current = await getStockBalance(enterpriseId, product.id);
    const delta = data.type === 'OUT' ? -data.quantity : data.quantity;

    // Saldo negativo não é erro de digitação recuperável depois: a linha é
    // append-only, então só um ajuste a desfaria. Barra antes de gravar.
    if (current + delta < 0) {
      throw new AppError('negativeBalance');
    }

    const movement = await prisma.stockMovement.create({
      data: {
        enterpriseId,
        productId: product.id,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
        createdBy: userId,
      },
      select: { id: true },
    });

    revalidatePath('/dashboard/inventory');

    return movement;
  });
}

export async function getInventoryKpis(): Promise<ActionResult<InventoryKpis>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');

    const products = await prisma.product.findMany({
      where: { enterpriseId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, costPrice: true, minStock: true, maxStock: true },
      take: MAX_PRODUCTS,
    });

    const balances = await getStockBalances(
      enterpriseId,
      products.map((product) => product.id)
    );

    let lowStock = 0;
    let outOfStock = 0;
    let stockValue = 0;

    for (const product of products) {
      const quantity = balances.get(product.id) ?? 0;
      const level = resolveStockLevel(
        quantity,
        toNumber(product.minStock),
        product.maxStock === null ? null : toNumber(product.maxStock)
      );

      if (level === 'OUT') {
        outOfStock += 1;
      } else if (level === 'LOW') {
        lowStock += 1;
      }

      // Estoque negativo não deveria existir, mas se existir não vira crédito
      // no valor imobilizado.
      stockValue += Math.max(quantity, 0) * toNumber(product.costPrice);
    }

    return { activeSkus: products.length, lowStock, outOfStock, stockValue };
  });
}

/**
 * Totais de entrada e saída por período. Até um mês o bucket é diário; acima
 * disso vira mensal, senão o gráfico de 12 meses viraria uma serra de 365
 * colunas ilegíveis.
 */
export async function getMovementFlow(days: number): Promise<ActionResult<MovementFlowPoint[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.view');

    const span = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 400) : 30;
    const monthly = span > 31;

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    if (monthly) {
      // Começar no dia 1 evita um primeiro bucket mensal pela metade, que
      // apareceria como uma coluna artificialmente baixa.
      since.setDate(1);
      since.setMonth(since.getMonth() - (Math.round(span / 30) - 1));
    } else {
      since.setDate(since.getDate() - (span - 1));
    }

    const movements = await prisma.stockMovement.findMany({
      where: { enterpriseId, createdAt: { gte: since } },
      select: { type: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const bucketKey = (date: Date) =>
      monthly
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // O eixo é montado a partir do período, não dos dados: um dia sem
    // movimentação precisa aparecer zerado em vez de sumir do gráfico.
    const buckets = new Map<string, MovementFlowPoint>();
    const cursor = new Date(since);
    const today = new Date();

    while (cursor <= today) {
      const key = bucketKey(cursor);

      if (!buckets.has(key)) {
        buckets.set(key, { date: key, in: 0, out: 0 });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    for (const movement of movements) {
      const point = buckets.get(bucketKey(movement.createdAt));

      if (!point) {
        continue;
      }

      const quantity = toNumber(movement.quantity);

      // O ajuste entra pelo lado que ele representa: positivo reforça o
      // estoque como uma entrada, negativo o consome como uma saída.
      if (movement.type === 'IN' || (movement.type === 'ADJUSTMENT' && quantity > 0)) {
        point.in += Math.abs(quantity);
      } else {
        point.out += Math.abs(quantity);
      }
    }

    return [...buckets.values()];
  });
}

export async function exportStockBalance(
  params: StockBalanceParams
): Promise<ActionResult<StockBalanceRow[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('inventory.export');
    const input = stockBalanceParamsSchema.parse(params);

    return loadBalanceRows(enterpriseId, input);
  });
}
