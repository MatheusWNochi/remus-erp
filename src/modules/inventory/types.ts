import type { stockMovementType } from '@/generated/prisma/enums';
import type { StockLevel } from '@/lib/server/stock';

export type MovementType = stockMovementType;
export type { StockLevel };

/**
 * DTO serializável devolvido pelas server actions (sem Decimal/Date cru).
 *
 * `id` repete `productId` porque o DataTable identifica a linha por `id` — o
 * saldo não é uma entidade própria, é a soma das movimentações do produto.
 */
export type StockBalanceRow = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  categoryName: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  maxStock: number | null;
  level: StockLevel;
};

export type MovementRow = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  userName: string | null;
};

export type StockBalanceParams = {
  search?: string;
  categoryId?: string;
  level?: StockLevel | 'ALL';
  lowStock?: boolean;
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
};

export type CategoryOption = {
  id: string;
  name: string;
};

export type StockBalanceResult = {
  rows: StockBalanceRow[];
  /** Já reflete os filtros aplicados em memória, não o total do catálogo. */
  total: number;
  /** Categorias da empresa, para alimentar o filtro sem uma segunda chamada. */
  categories: CategoryOption[];
};

export type MovementListParams = {
  search?: string;
  productId?: string;
  type?: MovementType | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
};

export type MovementListResult = {
  rows: MovementRow[];
  total: number;
};

export type InventoryKpis = {
  activeSkus: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
};

/**
 * Um ponto da série do gráfico "Entradas x Saídas". `date` é o início do
 * bucket em ISO — quem renderiza conhece o período escolhido e formata o
 * rótulo no locale ativo, coisa que o servidor não sabe fazer.
 */
export type MovementFlowPoint = {
  date: string;
  in: number;
  out: number;
};

/** Produto resolvido para o Autocomplete do formulário. */
export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

export type ProductBalance = ProductOption & {
  quantity: number;
};
