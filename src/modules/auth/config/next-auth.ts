import type { AuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';

import { authorize } from '../actions';

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        Object.assign(token, user);
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session && new Date() >= new Date(session.expires as string)) {
        session.expires = 'Session expired';
        return session;
      }

      if (session.user) {
        Object.assign(session.user, token);
      }

      return session;
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const { email, password } = credentials || {};

        if (!email || !password) {
          throw new Error('Missing credentials');
        }

        return authorize({ email, password });
      },
    }),
  ],
};

export const Auth = NextAuth(authOptions);