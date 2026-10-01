import 'server-only';

import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/modules/auth/config/next-auth';
import type { AuthUser } from '@/modules/auth/types';
import type { Permission } from '@/lib/permissions';

export const TENANT_COOKIE = 'remus.enterprise';

/**
 * Erro de negócio cujo `message` é uma chave do namespace `Errors` do
 * next-intl. Server actions o capturam e devolvem a chave para a tela
 * traduzir — nada de mensagem crua vazando para o usuário.
 */
export class AppError extends Error {
  constructor(key: string) {
    super(key);
    this.name = 'AppError';
  }
}

export type SessionContext = {
  userId: string;
  /** Empresa ativa. Para desenvolvedores, vem do seletor da navbar. */
  enterpriseId: string;
  isDeveloper: boolean;
  permissions: string[];
};

/**
 * Resolve o tenant ativo.
 *
 * Usuário comum fica preso à própria empresa — o cookie é ignorado de
 * propósito, senão bastaria forjá-lo para ler dados de outro tenant.
 * Desenvolvedor não pertence a empresa nenhuma e escolhe pelo seletor; o
 * valor do cookie só é aceito depois de confirmado que a empresa existe.
 */
async function resolveEnterpriseId(user: {
  enterpriseId: string | null;
  isDeveloper: boolean;
}): Promise<string | null> {
  if (!user.isDeveloper) {
    return user.enterpriseId;
  }

  const selected = (await cookies()).get(TENANT_COOKIE)?.value;

  if (selected) {
    const match = await prisma.enterprise.findFirst({
      where: { id: selected, deletedAt: null },
      select: { id: true },
    });

    if (match) {
      return match.id;
    }
  }

  const fallback = await prisma.enterprise.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

/**
 * Contexto da requisição, ou `null` se não houver sessão válida.
 *
 * As permissões são lidas do banco a cada chamada, não do JWT: revogar um
 * papel precisa valer na hora, sem esperar o usuário deslogar.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await getServerSession(authOptions);
  // `next-auth` reexporta `Session` por um módulo interno, então o
  // declaration merging do projeto só alcança o JWT (ver `next-auth.d.ts`).
  // O cast espelha o que o AuthProvider já faz no client.
  const userId = (session?.user as AuthUser | undefined)?.id;

  if (!userId) {
    return null;
  }

  const user = await prisma.authUser.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      enterpriseId: true,
      isDeveloper: true,
      status: true,
      role: {
        select: {
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  });

  if (!user || user.status === 'INACTIVE') {
    return null;
  }

  const enterpriseId = await resolveEnterpriseId(user);

  if (!enterpriseId) {
    return null;
  }

  return {
    userId: user.id,
    enterpriseId,
    isDeveloper: user.isDeveloper,
    permissions: user.role.rolePermissions.map((item) => item.permission.code),
  };
}

export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext();

  if (!context) {
    throw new AppError('unauthorized');
  }

  return context;
}

export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const context = await requireSession();

  if (!context.permissions.includes(permission)) {
    throw new AppError('forbidden');
  }

  return context;
}
