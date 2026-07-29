'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signIn as _signIn, signOut as _signOut, useSession } from 'next-auth/react';

import { AuthContext } from '.';
import { AuthContextValue, AuthUser } from '../types';

export { SessionProvider } from 'next-auth/react';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const { status, data: session } = useSession();

  const user = (session?.user as AuthUser | undefined) || null;
  const isPending = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const signOut = async (redirect: boolean = true) => {
    await _signOut({
      redirect,
      callbackUrl: '/auth/login',
    });
  };

  const signIn = async (email: string, password: string, returnTo?: string) => {
    return _signIn('credentials', {
      email,
      password,
      callbackUrl: returnTo || '/dashboard',
      redirect: false,
    });
  };

  useEffect(() => {
    if (session?.expires === 'Session expired') {
      router.push('/auth/login');
    }
  }, [router, session]);

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated,
      isPending,
      user,
      signOut,
      signIn,
    }),
    [isAuthenticated, isPending, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}