import 'server-only';

import { prisma } from '@/lib/prisma';
import { toNumber } from '@/utils/format';

export type StockLevel = 'OK' | 'LOW' | 'OUT' | 'EXCESS';

/**
 * Saldo por produto, sempre derivado de `stock_movement` — nunca de uma
 * coluna de quantidade no produto. É a única fonte de verdade do estoque,
 * usada tanto pelo módulo de Estoque quanto pela listagem de Produtos.
 */
export async function getStockBalances(
  enterpriseId: string,
  productIds?: string[]
): Promise<Map<string, number>> {
  if (productIds && productIds.length === 0) {
    return new Map();
  }

  const groups = await prisma.stockMovement.groupBy({
    by: ['productId', 'type'],
    where: {
      enterpriseId,
      ...(productIds ? { productId: { in: productIds } } : {}),
    },
    _sum: { quantity: true },
  });

  const balances = new Map<string, number>();

  for (const group of groups) {
    const quantity = toNumber(group._sum.quantity);
    // Entradas e saídas são gravadas positivas; o sinal vem do tipo. Ajustes
    // já carregam o próprio sinal.
    const signed = group.type === 'OUT' ? -quantity : quantity;

    balances.set(group.productId, (balances.get(group.productId) ?? 0) + signed);
  }

  return balances;
}

export async function getStockBalance(enterpriseId: string, productId: string): Promise<number> {
  const balances = await getStockBalances(enterpriseId, [productId]);

  return balances.get(productId) ?? 0;
}

/** Classifica o saldo contra os limites cadastrados no produto. */
export function resolveStockLevel(
  quantity: number,
  minStock: number,
  maxStock: number | null
): StockLevel {
  if (quantity <= 0) {
    return 'OUT';
  }

  if (quantity < minStock) {
    return 'LOW';
  }

  if (maxStock !== null && maxStock > 0 && quantity > maxStock) {
    return 'EXCESS';
  }

  return 'OK';
}
