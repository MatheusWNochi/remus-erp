import type { AuthUser } from '../types';

// `next-auth`'s `User`/`Session` types are re-exported via `export *` from an
// internal module, so declaration merging against `next-auth` directly does
// not apply here. `next-auth/jwt` declares `JWT` itself, so this one does merge.
declare module 'next-auth/jwt' {
  // Corpo vazio de propósito: a interface só existe para fundir os campos de
  // `AuthUser` na `JWT` do next-auth. Um `type` não faz declaration merging,
  // então a herança vazia é a única forma de escrever isto.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT extends AuthUser {}
}
