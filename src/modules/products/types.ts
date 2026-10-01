import type { productStatus } from '@/generated/prisma/enums';
// `import type` é apagado na compilação, então o `server-only` de `lib/server`
// não vaza para os componentes de client que consomem estes DTOs.
import type { StockLevel } from '@/lib/server/stock';

export type ProductStatus = productStatus;
export type ProductStockLevel = StockLevel;

export type ProductCategoryOption = {
  id: string;
  name: string;
};

/** DTO serializável devolvido pelas server actions (sem Decimal/Date cru). */
export type ProductListItem = {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  /** Fração (0.25 = 25%), já calculada no servidor para a lista não divergir. */
  margin: number;
  minStock: number;
  maxStock: number | null;
  /** Saldo derivado de `stock_movement`, nunca uma coluna do produto. */
  stock: number;
  stockLevel: ProductStockLevel;
  status: ProductStatus;
  createdAt: string;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  updatedAt: string;
};

export type ProductListParams = {
  search?: string;
  categoryId?: string | 'ALL';
  status?: ProductStatus | 'ALL';
  /** Só itens abaixo do mínimo — filtro derivado, resolvido em memória. */
  lowStock?: boolean;
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
};

export type ProductListResult = {
  rows: ProductListItem[];
  total: number;
  /** Categorias da empresa, para alimentar filtro e formulário sem outra ida. */
  categories: ProductCategoryOption[];
};

/** Um ponto do gráfico de movimentações do produto. */
export type ProductMovementPoint = {
  date: string;
  in: number;
  out: number;
};
