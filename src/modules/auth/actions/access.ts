'use server';

import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { AppError, TENANT_COOKIE, getSessionContext, requireSession } from '@/lib/server/session';

export type EnterpriseOption = {
  id: string;
  name: string;
};

export type AccessPayload = {
  userId: string;
  enterpriseId: string;
  enterpriseName: string;
  isDeveloper: boolean;
  permissions: string[];
  /** Preenchido apenas para desenvolvedores — alimenta o seletor da navbar. */
  enterprises: EnterpriseOption[];
};

/**
 * Tudo que o client precisa para desenhar a interface: o que o usuário pode
 * fazer e em qual empresa. Lido do banco a cada carga, para que mudança de
 * papel valha sem exigir novo login.
 */
export async function getMyAccess(): Promise<ActionResult<AccessPayload>> {
  return action(async () => {
    const context = await getSessionContext();

    if (!context) {
      throw new AppError('unauthorized');
    }

    const enterprise = await prisma.enterprise.findUnique({
      where: { id: context.enterpriseId },
      select: { id: true, name: true },
    });

    const enterprises = context.isDeveloper
      ? await prisma.enterprise.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [];

    return {
      userId: context.userId,
      enterpriseId: context.enterpriseId,
      enterpriseName: enterprise?.name ?? '',
      isDeveloper: context.isDeveloper,
      permissions: context.permissions,
      enterprises,
    } satisfies AccessPayload;
  });
}

/**
 * Troca o tenant ativo. Só desenvolvedores podem — para um usuário comum a
 * empresa vem do próprio cadastro e o cookie é ignorado na leitura, mas
 * recusar aqui também evita dar a impressão de que a troca funcionou.
 */
export async function selectEnterprise(enterpriseId: string): Promise<ActionResult<null>> {
  return action(async () => {
    const context = await requireSession();

    if (!context.isDeveloper) {
      throw new AppError('forbidden');
    }

    const enterprise = await prisma.enterprise.findFirst({
      where: { id: enterpriseId, deletedAt: null },
      select: { id: true },
    });

    if (!enterprise) {
      throw new AppError('notFound');
    }

    (await cookies()).set(TENANT_COOKIE, enterprise.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return null;
  });
}
