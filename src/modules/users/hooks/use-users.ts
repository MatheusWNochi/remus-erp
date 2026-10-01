'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listRoles, listUsers } from '../actions';
import type { RoleListItem, UserListItem, UserListParams, UserStatus } from '../types';

export function useUsers() {
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | 'ALL'>('ALL');
  const [roleId, setRoleId] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  // Ver nota em use-products: o sort inicial tem de existir entre as colunas.
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'firstName', sort: 'asc' }]);

  /**
   * O resultado carrega junto os parâmetros que o produziram. Isso dá duas
   * coisas de graça: `isLoading` é derivado (sem setState em tempo de efeito)
   * e uma resposta antiga nunca sobrescreve uma nova, porque o efeito que a
   * pediu já foi cancelado.
   */
  const [loaded, setLoaded] = useState<{
    params: UserListParams;
    rows: UserListItem[];
    total: number;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [rolesToken, setRolesToken] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo<UserListParams>(
    () => ({
      search: debouncedSearch || undefined,
      status,
      roleId,
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      sortField: sortModel[0]?.field,
      sortDirection: sortModel[0]?.sort ?? undefined,
    }),
    [debouncedSearch, status, roleId, paginationModel, sortModel]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listUsers(params);

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

  /**
   * Papéis alimentam o filtro, o formulário, a matriz e o aviso de perda de
   * acesso — carregar uma vez por tela evita quatro chamadas iguais.
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listRoles();

      if (active) {
        setRoles(result.ok ? result.data : []);
      }
    })();

    return () => {
      active = false;
    };
  }, [rolesToken]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);
  const refreshRoles = useCallback(() => setRolesToken((token) => token + 1), []);

  const rows = loaded?.rows ?? [];
  const total = loaded?.total ?? 0;
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
    (value: UserStatus | 'ALL') => {
      setStatus(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleRoleChange = useCallback(
    (value: string) => {
      setRoleId(value);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const clearFilters = useCallback(() => {
    setStatus('ALL');
    setRoleId('ALL');
    resetToFirstPage();
  }, [resetToFirstPage]);

  return {
    rows,
    total,
    roles,
    isLoading,
    params,
    search,
    status,
    roleId,
    paginationModel,
    sortModel,
    setPaginationModel,
    setSortModel,
    onSearchChange: handleSearchChange,
    onStatusChange: handleStatusChange,
    onRoleChange: handleRoleChange,
    clearFilters,
    refresh,
    refreshRoles,
  };
}
