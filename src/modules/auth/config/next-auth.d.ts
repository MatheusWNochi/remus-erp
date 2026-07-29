import type { AuthUser } from '../types';

// `next-auth`'s `User`/`Session` types are re-exported via `export *` from an
// internal module, so declaration merging against `next-auth` directly does
// not apply here. `next-auth/jwt` declares `JWT` itself, so this one does merge.
declare module 'next-auth/jwt' {
  interface JWT extends AuthUser {}
}
