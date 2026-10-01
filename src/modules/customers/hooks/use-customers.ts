'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listCustomers } from '../actions';
import type { CustomerListItem, CustomerListParams, CustomerStatus } from '../types';

export function useCustomers() {
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | 'ALL'>('ALL');
  const [state, setState] = useState<string>('ALL');
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
    params: CustomerListParams;
    rows: CustomerListItem[];
    total: number;
    states: string[];
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo<CustomerListParams>(
    () => ({
      search: debouncedSearch || undefined,
      status,
      state,
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      sortField: sortModel[0]?.field,
      sortDirection: sortModel[0]?.sort ?? undefined,
    }),
    [debouncedSearch, status, state, paginationModel, sortModel]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listCustomers(params);

      if (!active) {
        return;
      }

      if (result.ok) {
        setLoaded({ params, ...result.data });
      } else {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        setLoaded({ params, rows: [], total: 0, states: [] });
      }
    })();

    return () => {
      active = false;
    };
  }, [params, reloadToken, enqueueSnackbar, tErrors]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const rows = loaded?.rows ?? [];
  const total = loaded?.total ?? 0;
  const states = loaded?.states ?? [];
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
    (value: CustomerStatus | 'ALL') => {
      setStatus(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleStateChange = useCallback(
    (value: string) => {
      setState(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const clearFilters = useCallback(() => {
    setStatus('ALL');
    setState('ALL');
    resetToFirstPage();
  }, [resetToFirstPage]);

  return {
    rows,
    total,
    states,
    isLoading,
    params,
    search,
    status,
    state,
    paginationModel,
    sortModel,
    setPaginationModel,
    setSortModel,
    onSearchChange: handleSearchChange,
    onStatusChange: handleStatusChange,
    onStateChange: handleStateChange,
    clearFilters,
    refresh,
  };
}
