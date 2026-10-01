'use client';

import { useEffect, useState } from 'react';
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

  // Liberar a tela é derivar estado de props, não sincronizar com um sistema
  // externo: ajustar durante o render evita o salto de um render extra (e o
  // setState em tempo de efeito que vinha junto). Uma vez liberado, continua
  // liberado — um login feito aqui não traz a splash de volta.
  if (isChecking && !isPending && !isAuthenticated) {
    setIsChecking(false);
  }

  useEffect(() => {
    if (isPending || !isAuthenticated) {
      return;
    }

    router.replace(returnTo);
  }, [isAuthenticated, isPending, returnTo, router]);

  if (isChecking) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}