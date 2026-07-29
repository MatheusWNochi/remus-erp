'use client';

import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

import { useAuth } from '../hooks/use-auth';
import { SplashScreen } from '@/components/loading-screen';

type Props = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isPending } = useAuth();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    if (isPending || isAuthenticated) {
      return;
    }

    const href = `/auth/login?${createQueryString('returnTo', pathname)}`;
    router.replace(href);
  }, [createQueryString, isAuthenticated, isPending, pathname, router]);

  if (isPending || !isAuthenticated) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}