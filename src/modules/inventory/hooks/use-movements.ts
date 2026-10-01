'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listMovements } from '../actions';
import type { MovementListParams, MovementRow, MovementType } from '../types';

export function useMovements() {
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<MovementType | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'createdAt', sort: 'desc' }]);

  /**
   * O resultado carrega junto os parâmetros que o produziram. Isso dá duas
   * coisas de graça: `isLoading` é derivado (sem setState em tempo de efeito)
   * e uma resposta antiga nunca sobrescreve uma nova, porque o efeito que a
   * pediu já foi cancelado.
   */
  const [loaded, setLoaded] = useState<{
    params: MovementListParams;
    rows: MovementRow[];
    total: number;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo<MovementListParams>(
    () => ({
      search: debouncedSearch || undefined,
      type,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      sortField: sortModel[0]?.field,
      sortDirection: sortModel[0]?.sort ?? undefined,
    }),
    [debouncedSearch, type, dateFrom, dateTo, paginationModel, sortModel]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listMovements(params);

      if (!active) {
        return;
      }

      if (result.ok) {
        setLoaded({ params, ...result.data });
      } else {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        setLoaded({ params, rows: [], total: 0 });
      }
    })();

    return () => {
      active = false;
    };
  }, [params, reloadToken, enqueueSnackbar, tErrors]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const rows = loaded?.rows ?? [];
  const total = loaded?.total ?? 0;
  const isLoading = loaded?.params !== params;

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

  const handleTypeChange = useCallback(
    (value: MovementType | 'ALL') => {
      setType(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleDateFromChange = useCallback(
    (value: string) => {
      setDateFrom(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleDateToChange = useCallback(
    (value: string) => {
      setDateTo(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const clearFilters = useCallback(() => {
    setType('ALL');
    setDateFrom('');
    setDateTo('');
    resetToFirstPage();
  }, [resetToFirstPage]);

  return {
    rows,
    total,
    isLoading,
    params,
    search,
    type,
    dateFrom,
    dateTo,
    paginationModel,
    sortModel,
    setPaginationModel,
    setSortModel,
    onSearchChange: handleSearchChange,
    onTypeChange: handleTypeChange,
    onDateFromChange: handleDateFromChange,
    onDateToChange: handleDateToChange,
    clearFilters,
    refresh,
  };
}
