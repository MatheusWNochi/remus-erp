import type { SignInResponse } from 'next-auth/react';

import type { authUserModel } from '@/generated/prisma/models';

export type AuthUser = Omit<authUserModel, 'password'>;

export type AuthContextValue = {
  user: AuthUser | null;
  isPending: boolean;
  isAuthenticated: boolean;
  signOut: (redirect?: boolean) => Promise<void>;
  signIn: (
    email: string,
    password: string,
    returnTo?: string
  ) => Promise<SignInResponse | undefined>;
};