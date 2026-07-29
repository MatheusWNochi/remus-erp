'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

import { SplashScreen } from '@/components/loading-screen';

import { useAuth } from '../hooks/use-auth';

type Props = {
  children: React.ReactNode;
};

export function GuestGuard({ children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isPending } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const checkPermissions = useCallback(() => {
    if (isPending) {
      return;
    }

    if (isAuthenticated) {
      router.replace(returnTo);
      return;
    }

    setIsChecking(false);
  }, [isAuthenticated, isPending, returnTo, router]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  if (isChecking) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}