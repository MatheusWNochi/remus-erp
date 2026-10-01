'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listStockBalance } from '../actions';
import type { CategoryOption, StockBalanceParams, StockBalanceRow, StockLevel } from '../types';

export function useStockBalance() {
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [level, setLevel] = useState<StockLevel | 'ALL'>('ALL');
  const [lowStock, setLowStock] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'name', sort: 'asc' }]);

  /**
   * O resultado carrega junto os parâmetros que o produziram. Isso dá duas
   * coisas de graça: `isLoading` é derivado (sem setState em tempo de efeito)
   * e uma resposta antiga nunca sobrescreve uma nova, porque o efeito que a
   * pediu já foi cancelado.
   */
  const [loaded, setLoaded] = useState<{
    params: StockBalanceParams;
    rows: StockBalanceRow[];
    total: number;
    categories: CategoryOption[];
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo<StockBalanceParams>(
    () => ({
      search: debouncedSearch || undefined,
      categoryId,
      level,
      lowStock,
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      sortField: sortModel[0]?.field,
      sortDirection: sortModel[0]?.sort ?? undefined,
    }),
    [debouncedSearch, categoryId, level, lowStock, paginationModel, sortModel]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listStockBalance(params);

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

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategoryId(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleLevelChange = useCallback(
    (value: StockLevel | 'ALL') => {
      setLevel(value);
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
    setCategoryId('ALL');
    setLevel('ALL');
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
    categoryId,
    level,
    lowStock,
    paginationModel,
    sortModel,
    setPaginationModel,
    setSortModel,
    onSearchChange: handleSearchChange,
    onCategoryChange: handleCategoryChange,
    onLevelChange: handleLevelChange,
    onLowStockChange: handleLowStockChange,
    clearFilters,
    refresh,
  };
}
