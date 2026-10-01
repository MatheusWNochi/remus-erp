'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listProducts } from '../actions';
import type {
  ProductCategoryOption,
  ProductListItem,
  ProductListParams,
  ProductStatus,
} from '../types';

export function useProducts() {
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL');
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [lowStock, setLowStock] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  // A ordenação inicial precisa apontar para uma coluna que existe na grade:
  // o DataGrid descarta um sort de campo desconhecido durante o próprio
  // render e avisa o pai, o que dispara setState em tempo de renderização.
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'name', sort: 'asc' }]);

  /**
   * O resultado carrega junto os parâmetros que o produziram. Isso dá duas
   * coisas de graça: `isLoading` é derivado (sem setState em tempo de efeito)
   * e uma resposta antiga nunca sobrescreve uma nova, porque o efeito que a
   * pediu já foi cancelado.
   */
  const [loaded, setLoaded] = useState<{
    params: ProductListParams;
    rows: ProductListItem[];
    total: number;
    categories: ProductCategoryOption[];
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo<ProductListParams>(
    () => ({
      search: debouncedSearch || undefined,
      status,
      categoryId,
      lowStock,
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      sortField: sortModel[0]?.field,
      sortDirection: sortModel[0]?.sort ?? undefined,
    }),
    [debouncedSearch, status, categoryId, lowStock, paginationModel, sortModel]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listProducts(params);

      if (!active) {
        return;
      }

      if (result.ok) {
        setLoaded({ params, ...result.data });
      } else {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        // A lista de categorias alimenta o filtro: um erro de busca não é
        // motivo para esvaziá-la.
        setLoaded((current) => ({
          params,
          rows: [],
          total: 0,
          categories: current?.categories ?? [],
        }));
      }
    })();

    return () => {
      active = false;
    };
  }, [params, reloadToken, enqueueSnackbar, tErrors]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const rows = loaded?.rows ?? [];
  const total = loaded?.total ?? 0;
  const categories = loaded?.categories ?? [];
  const isLoading = loaded?.params !== params;

  // Mudar um filtro com a lista na página 5 deixaria o usuário olhando para
  // um vazio que não é vazio — volta para a primeira página.
  const resetToFirstPage = useCallback(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleStatusChange = useCallback(
    (value: ProductStatus | 'ALL') => {
      setStatus(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategoryId(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleLowStockChange = useCallback(
    (value: boolean) => {
      setLowStock(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const clearFilters = useCallback(() => {
    setStatus('ALL');
    setCategoryId('ALL');
    setLowStock(false);
    resetToFirstPage();
  }, [resetToFirstPage]);

  return {
    rows,
    total,
    categories,
    isLoading,
    params,
    search,
    status,
    categoryId,
    lowStock,
    paginationModel,
    sortModel,
    setPaginationModel,
    setSortModel,
    onSearchChange: handleSearchChange,
    onStatusChange: handleStatusChange,
    onCategoryChange: handleCategoryChange,
    onLowStockChange: handleLowStockChange,
    clearFilters,
    refresh,
  };
}
