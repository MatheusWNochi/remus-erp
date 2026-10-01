'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { Permission } from '@/lib/permissions';
import { getMyAccess, type AccessPayload } from '../actions/access';
import { useAuth } from '../hooks/use-auth';

export type AccessContextValue = {
  access: AccessPayload | null;
  isLoading: boolean;
  /** `false` enquanto carrega — evita piscar botões que o usuário não pode usar. */
  can: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
};

export const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  /**
   * Guardamos junto o `isAuthenticated` que originou a carga: `isLoading` sai
   * daí por derivação, sem nenhum setState em tempo de efeito, e um payload
   * antigo nunca vale para uma sessão nova.
   */
  const [loaded, setLoaded] = useState<{
    isAuthenticated: boolean;
    access: AccessPayload | null;
  } | null>(null);

  /**
   * Sem setState: só busca. O `await` acontece mesmo deslogado para que quem
   * chama nunca atualize estado de forma síncrona dentro do efeito.
   */
  const fetchAccess = useCallback(async () => {
    const result = await (isAuthenticated ? getMyAccess() : Promise.resolve(null));

    return { isAuthenticated, access: result?.ok ? result.data : null };
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const next = await fetchAccess();

      if (active) {
        setLoaded(next);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchAccess]);

  const refresh = useCallback(async () => {
    setLoaded(await fetchAccess());
  }, [fetchAccess]);

  const isReady = loaded !== null && loaded.isAuthenticated === isAuthenticated;
  const access = isReady ? loaded.access : null;
  const isLoading = isAuthenticated && !isReady;

  const can = useCallback(
    (permission: Permission) => access?.permissions.includes(permission) ?? false,
    [access]
  );

  const value = useMemo<AccessContextValue>(
    () => ({ access, isLoading, can, refresh }),
    [access, isLoading, can, refresh]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
