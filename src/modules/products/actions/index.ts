'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { AppError, requirePermission } from '@/lib/server/session';
import { getStockBalance, getStockBalances, resolveStockLevel } from '@/lib/server/stock';
import { toNumber } from '@/utils/format';
import type { Prisma } from '@/generated/prisma/client';
import type {
  ProductCategoryOption,
  ProductDetail,
  ProductListItem,
  ProductListParams,
  ProductListResult,
  ProductMovementPoint,
} from '../types';
import {
  categoryFormSchema,
  productFormSchema,
  productListParamsSchema,
  type CategoryFormValues,
  type ProductFormValues,
} from './schema';

const LIST_SELECT = {
  id: true,
  name: true,
  sku: true,
  categoryId: true,
  unit: true,
  costPrice: true,
  salePrice: true,
  minStock: true,
  maxStock: true,
  status: true,
  createdAt: true,
  category: { select: { name: true } },
} satisfies Prisma.productSelect;

type ListRow = Prisma.productGetPayload<{ select: typeof LIST_SELECT }>;

const DB_SORT_FIELDS = new Set(['name', 'sku', 'costPrice', 'salePrice', 'status', 'createdAt']);
/** Estoque e margem não existem em coluna: só dá para ordenar em memória. */
const DERIVED_SORT_FIELDS = new Set(['stock', 'margin']);

/**
 * Teto da varredura em memória (filtro de estoque baixo e ordenação derivada).
 * Acima disso a lista deixaria de ser paginação e viraria carga do catálogo
 * inteiro a cada tecla digitada na busca.
 */
const SCAN_LIMIT = 5000;

function resolveMargin(costPrice: number, salePrice: number): number {
  return salePrice > 0 ? (salePrice - costPrice) / salePrice : 0;
}

function toListItem(row: ListRow, stock: number): ProductListItem {
  const costPrice = toNumber(row.costPrice);
  const salePrice = toNumber(row.salePrice);
  const minStock = toNumber(row.minStock);
  const maxStock = row.maxStock === null ? null : toNumber(row.maxStock);

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    unit: row.unit,
    // `Decimal` do Prisma não atravessa a fronteira server -> client, então
    // tudo vira `number` antes de sair da action.
    costPrice,
    salePrice,
    margin: resolveMargin(costPrice, salePrice),
    minStock,
    maxStock,
    stock,
    stockLevel: resolveStockLevel(stock, minStock, maxStock),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

type ListInput = ReturnType<typeof productListParamsSchema.parse>;

function buildWhere(enterpriseId: string, input: ListInput): Prisma.productWhereInput {
  return {
    enterpriseId,
    deletedAt: null,
    ...(input.status !== 'ALL' ? { status: input.status } : {}),
    ...(input.categoryId !== 'ALL'
      ? { categoryId: input.categoryId === 'NONE' ? null : input.categoryId }
      : {}),
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

function buildOrderBy(
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Prisma.productOrderByWithRelationInput {
  if (sortField === 'categoryName') {
    return { category: { name: sortDirection } };
  }

  return DB_SORT_FIELDS.has(sortField)
    ? { [sortField]: sortDirection }
    : { createdAt: sortDirection };
}

function compareItems(
  a: ProductListItem,
  b: ProductListItem,
  sortField: string,
  sortDirection: 'asc' | 'desc'
): number {
  const factor = sortDirection === 'asc' ? 1 : -1;

  if (sortField === 'stock' || sortField === 'margin') {
    return (a[sortField] - b[sortField]) * factor;
  }

  if (sortField === 'costPrice' || sortField === 'salePrice') {
    return (a[sortField] - b[sortField]) * factor;
  }

  if (sortField === 'createdAt') {
    return a.createdAt.localeCompare(b.createdAt) * factor;
  }

  if (sortField === 'categoryName') {
    return (a.categoryName ?? '').localeCompare(b.categoryName ?? '') * factor;
  }

  if (sortField === 'sku' || sortField === 'status') {
    return a[sortField].localeCompare(b[sortField]) * factor;
  }

  return a.name.localeCompare(b.name) * factor;
}

async function loadCategories(enterpriseId: string): Promise<ProductCategoryOption[]> {
  return prisma.productCategory.findMany({
    where: { enterpriseId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listProducts(
  params: ProductListParams
): Promise<ActionResult<ProductListResult>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.view');
    const input = productListParamsSchema.parse(params);

    const where = buildWhere(enterpriseId, input);
    const sortField = input.sortField ?? 'createdAt';
    const sortDirection = input.sortDirection ?? 'desc';

    // Estoque é derivado dos lançamentos, então nem o filtro de estoque baixo
    // nem a ordenação por saldo/margem cabem no SQL. Nesses casos a varredura
    // é assumida de propósito: pagina-se depois de montar a lista inteira,
    // para que `total` reflita o que o usuário realmente consegue ver.
    const needsScan = input.lowStock || DERIVED_SORT_FIELDS.has(sortField);

    if (needsScan) {
      const [rows, categories] = await Promise.all([
        prisma.product.findMany({
          where,
          select: LIST_SELECT,
          orderBy: buildOrderBy(sortField, sortDirection),
          take: SCAN_LIMIT,
        }),
        loadCategories(enterpriseId),
      ]);

      const balances = await getStockBalances(
        enterpriseId,
        rows.map((row) => row.id)
      );

      const items = rows
        .map((row) => toListItem(row, balances.get(row.id) ?? 0))
        .filter((item) => !input.lowStock || item.stockLevel === 'LOW' || item.stockLevel === 'OUT')
        .sort((a, b) => compareItems(a, b, sortField, sortDirection));

      const start = input.page * input.pageSize;

      return {
        rows: items.slice(start, start + input.pageSize),
        total: items.length,
        categories,
      };
    }

    const [rows, total, categories] = await Promise.all([
      prisma.product.findMany({
        where,
        select: LIST_SELECT,
        orderBy: buildOrderBy(sortField, sortDirection),
        skip: input.page * input.pageSize,
        take: input.pageSize,
      }),
      prisma.product.count({ where }),
      loadCategories(enterpriseId),
    ]);

    const balances = await getStockBalances(
      enterpriseId,
      rows.map((row) => row.id)
    );

    return {
      rows: rows.map((row) => toListItem(row, balances.get(row.id) ?? 0)),
      total,
      categories,
    };
  });
}

export async function getProduct(id: string): Promise<ActionResult<ProductDetail>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.view');

    const product = await prisma.product.findFirst({
      where: { id, enterpriseId, deletedAt: null },
      select: { ...LIST_SELECT, description: true, updatedAt: true },
    });

    if (!product) {
      throw new AppError('notFound');
    }

    const stock = await getStockBalance(enterpriseId, product.id);

    return {
      ...toListItem(product, stock),
      description: product.description,
      updatedAt: product.updatedAt.toISOString(),
    };
  });
}

export async function createProduct(values: ProductFormValues): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('products.create');
    const data = productFormSchema.parse(values);

    const product = await prisma.product.create({
      data: { ...data, enterpriseId, createdBy: userId },
      select: { id: true },
    });

    revalidatePath('/dashboard/products');

    return product;
  });
}

export async function updateProduct(
  id: string,
  values: ProductFormValues
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.edit');
    const data = productFormSchema.parse(values);

    // `updateMany` + filtro por enterprise garante que um id de outro tenant
    // simplesmente não encontre nada, em vez de atualizar o registro alheio.
    const result = await prisma.product.updateMany({
      where: { id, enterpriseId, deletedAt: null },
      data: { ...data, updatedAt: new Date() },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/products');

    return { id };
  });
}

/**
 * Exclusão lógica. Produto com saldo em estoque só sai do catálogo se o
 * usuário insistir (`force`): o histórico continua lá, mas o saldo passaria a
 * não aparecer em lugar nenhum, então o aviso vem antes.
 */
export async function deleteProduct(
  id: string,
  force?: boolean
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('products.delete');

    if (!force) {
      const balance = await getStockBalance(enterpriseId, id);

      if (balance !== 0) {
        throw new AppError('hasStock');
      }
    }

    const result = await prisma.product.updateMany({
      where: { id, enterpriseId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: userId },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/products');

    return { id };
  });
}

/** Desfaz uma exclusão recente (toast "Desfazer"). */
export async function restoreProduct(id: string): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.delete');

    const result = await prisma.product.updateMany({
      where: { id, enterpriseId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedBy: null },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/products');

    return { id };
  });
}

export async function setProductsStatus(
  ids: string[],
  status: 'ACTIVE' | 'INACTIVE'
): Promise<ActionResult<{ count: number }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.edit');

    if (ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: ids }, enterpriseId, deletedAt: null },
      data: { status, updatedAt: new Date() },
    });

    revalidatePath('/dashboard/products');

    return { count: result.count };
  });
}

/**
 * Exporta a seleção (ou o resultado filtrado inteiro, se nada estiver
 * selecionado) como linhas prontas para virar CSV no client.
 */
export async function exportProducts(
  params: ProductListParams,
  ids?: string[]
): Promise<ActionResult<ProductListItem[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.export');
    const input = productListParamsSchema.parse(params);

    const where: Prisma.productWhereInput = {
      ...buildWhere(enterpriseId, input),
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    };

    const rows = await prisma.product.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { name: 'asc' },
      take: SCAN_LIMIT,
    });

    const balances = await getStockBalances(
      enterpriseId,
      rows.map((row) => row.id)
    );

    const items = rows.map((row) => toListItem(row, balances.get(row.id) ?? 0));

    // O filtro de estoque baixo também vale na exportação — exportar mais do
    // que a tela mostra seria uma surpresa desagradável na planilha.
    return input.lowStock
      ? items.filter((item) => item.stockLevel === 'LOW' || item.stockLevel === 'OUT')
      : items;
  });
}

export async function listCategories(): Promise<ActionResult<ProductCategoryOption[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.view');

    return loadCategories(enterpriseId);
  });
}

export async function createCategory(
  values: CategoryFormValues
): Promise<ActionResult<ProductCategoryOption>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('products.create');
    const data = categoryFormSchema.parse(values);

    // Criar a categoria direto do formulário do produto é atalho comum; se o
    // nome já existe, devolve a existente em vez de duplicar o cadastro.
    const existing = await prisma.productCategory.findFirst({
      where: {
        enterpriseId,
        deletedAt: null,
        name: { equals: data.name, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    if (existing) {
      return existing;
    }

    const category = await prisma.productCategory.create({
      data: { name: data.name, enterpriseId, createdBy: userId },
      select: { id: true, name: true },
    });

    revalidatePath('/dashboard/products');

    return category;
  });
}

/**
 * Série diária de entradas e saídas do produto, para o gráfico da tela de
 * detalhe. Os dias sem lançamento vêm zerados para o eixo não "pular" datas.
 */
export async function getProductMovements(
  productId: string,
  days: number
): Promise<ActionResult<ProductMovementPoint[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('products.view');

    const span = Math.min(Math.max(Math.trunc(days), 1), 180);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (span - 1));

    const movements = await prisma.stockMovement.findMany({
      where: { enterpriseId, productId, createdAt: { gte: since } },
      select: { type: true, quantity: true, createdAt: true },
    });

    const buckets = new Map<string, ProductMovementPoint>();

    for (let offset = 0; offset < span; offset += 1) {
      const day = new Date(since);
      day.setUTCDate(day.getUTCDate() + offset);

      // Meio-dia UTC: a data cruza o fuso do navegador sem escorregar para o
      // dia anterior quando o gráfico formata o rótulo.
      day.setUTCHours(12, 0, 0, 0);
      buckets.set(day.toISOString().slice(0, 10), {
        date: day.toISOString(),
        in: 0,
        out: 0,
      });
    }

    for (const movement of movements) {
      const point = buckets.get(movement.createdAt.toISOString().slice(0, 10));

      if (!point) {
        continue;
      }

      const quantity = toNumber(movement.quantity);
      // Ajuste carrega o próprio sinal: negativo conta como saída.
      const signed = movement.type === 'OUT' ? -quantity : quantity;

      if (signed >= 0) {
        point.in += signed;
      } else {
        point.out += Math.abs(signed);
      }
    }

    return Array.from(buckets.values());
  });
}
