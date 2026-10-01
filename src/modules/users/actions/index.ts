'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { AppError, requirePermission } from '@/lib/server/session';
import { hash } from '@/modules/auth/utils/hash';
import { Prisma } from '@/generated/prisma/client';
import type { RoleListItem, UserListItem, UserListParams, UserListResult, UserStatus } from '../types';
import {
  roleFormSchema,
  userEditSchema,
  userInviteSchema,
  userListParamsSchema,
  type UserEditValues,
  type UserInviteValues,
} from './schema';

const LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  roleId: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { name: true } },
} satisfies Prisma.authUserSelect;

const SORTABLE_FIELDS = new Set(['firstName', 'email', 'status', 'lastLoginAt', 'createdAt']);

/**
 * Filtro base de toda consulta de usuários: além do tenant, exclui contas
 * `isDeveloper`, que não pertencem a empresa nenhuma e não devem aparecer —
 * nem ser editáveis — para quem administra um cliente.
 */
function tenantUsersWhere(enterpriseId: string): Prisma.authUserWhereInput {
  return { enterpriseId, deletedAt: null, isDeveloper: false };
}

function toListItem(row: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: { name: string };
}): UserListItem {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    roleId: row.roleId,
    roleName: row.role.name,
    status: row.status,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(params: UserListParams): Promise<ActionResult<UserListResult>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('users.view');
    const input = userListParamsSchema.parse(params);

    const where: Prisma.authUserWhereInput = {
      ...tenantUsersWhere(enterpriseId),
      ...(input.status !== 'ALL' ? { status: input.status } : {}),
      ...(input.roleId !== 'ALL' ? { roleId: input.roleId } : {}),
      ...(input.search
        ? {
            OR: [
              { firstName: { contains: input.search, mode: 'insensitive' } },
              { lastName: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sortField =
      input.sortField && SORTABLE_FIELDS.has(input.sortField) ? input.sortField : 'createdAt';
    const sortDirection = input.sortDirection ?? 'desc';

    const [rows, total] = await Promise.all([
      prisma.authUser.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [sortField]: sortDirection },
        skip: input.page * input.pageSize,
        take: input.pageSize,
      }),
      prisma.authUser.count({ where }),
    ]);

    return { rows: rows.map(toListItem), total };
  });
}

export async function getUser(id: string): Promise<ActionResult<UserListItem>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('users.view');

    const user = await prisma.authUser.findFirst({
      where: { id, ...tenantUsersWhere(enterpriseId) },
      select: LIST_SELECT,
    });

    if (!user) {
      throw new AppError('notFound');
    }

    return toListItem(user);
  });
}

export async function createUser(values: UserInviteValues): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('users.create');
    const data = userInviteSchema.parse(values);

    // E-mail é único globalmente, então a checagem prévia é só para dar a
    // mensagem certa; a corrida ainda cai no P2002 logo abaixo.
    const existing = await prisma.authUser.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError('emailTaken');
    }

    await assertRoleAvailable(data.roleId, enterpriseId);

    try {
      const user = await prisma.authUser.create({
        data: {
          // `auth_user.id` não tem default no banco — quem cria gera o uuid.
          id: crypto.randomUUID(),
          email: data.email,
          password: await hash(data.password),
          firstName: data.firstName,
          lastName: data.lastName,
          roleId: data.roleId,
          enterpriseId,
          status: 'INVITED',
          createdAt: new Date(),
        },
        select: { id: true },
      });

      revalidatePath('/dashboard/users');

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('emailTaken');
      }

      throw error;
    }
  });
}

export async function updateUser(
  id: string,
  values: UserEditValues
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('users.edit');
    const data = userEditSchema.parse(values);

    const target = await prisma.authUser.findFirst({
      where: { id, ...tenantUsersWhere(enterpriseId) },
      select: { id: true, roleId: true },
    });

    if (!target) {
      throw new AppError('notFound');
    }

    // Trocar o próprio papel é como se auto-promover (ou se trancar para
    // fora); a regra vale no servidor, não só no botão desabilitado.
    if (target.id === userId && target.roleId !== data.roleId) {
      throw new AppError('selfRoleChange');
    }

    await assertRoleAvailable(data.roleId, enterpriseId);

    // `updateMany` + filtro por enterprise garante que um id de outro tenant
    // simplesmente não encontre nada, em vez de atualizar o registro alheio.
    const result = await prisma.authUser.updateMany({
      where: { id, ...tenantUsersWhere(enterpriseId) },
      data: { firstName: data.firstName, lastName: data.lastName, roleId: data.roleId },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/users');

    return { id };
  });
}

export async function setUserStatus(
  id: string,
  status: UserStatus
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('users.edit');

    if (id === userId && status !== 'ACTIVE') {
      throw new AppError('selfDeactivate');
    }

    const result = await prisma.authUser.updateMany({
      where: { id, ...tenantUsersWhere(enterpriseId) },
      data: { status },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/users');

    return { id };
  });
}

/** Papéis visíveis para a empresa: os globais do sistema mais os próprios. */
function visibleRolesWhere(enterpriseId: string): Prisma.authRoleWhereInput {
  return { OR: [{ isSystem: true }, { enterpriseId }] };
}

async function assertRoleAvailable(roleId: string, enterpriseId: string): Promise<void> {
  const role = await prisma.authRole.findFirst({
    where: { id: roleId, ...visibleRolesWhere(enterpriseId) },
    select: { id: true },
  });

  if (!role) {
    throw new AppError('notFound');
  }
}

export async function listRoles(): Promise<ActionResult<RoleListItem[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('roles.view');

    const [roles, counts] = await Promise.all([
      prisma.authRole.findMany({
        where: visibleRolesWhere(enterpriseId),
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
      // O `_count` da relação contaria usuários de todos os tenants; a
      // contagem precisa do mesmo recorte da listagem.
      prisma.authUser.groupBy({
        by: ['roleId'],
        where: tenantUsersWhere(enterpriseId),
        _count: { _all: true },
      }),
    ]);

    const countByRole = new Map(counts.map((row) => [row.roleId, row._count._all]));

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: countByRole.get(role.id) ?? 0,
      permissionCodes: role.rolePermissions.map((item) => item.permission.code),
    }));
  });
}

export async function updateRolePermissions(
  roleId: string,
  codes: string[]
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('roles.edit');

    const role = await prisma.authRole.findFirst({
      where: { id: roleId, ...visibleRolesWhere(enterpriseId) },
      select: { id: true, isSystem: true },
    });

    if (!role) {
      throw new AppError('notFound');
    }

    // Papel de sistema é global: editá-lo aqui mudaria o acesso de todos os
    // tenants de uma vez.
    if (role.isSystem) {
      throw new AppError('forbidden');
    }

    const permissions = await prisma.authPermission.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });

    // Troca completa em vez de diff: a matriz sempre envia o estado final.
    await prisma.$transaction([
      prisma.rolePermissions.deleteMany({ where: { roleId } }),
      prisma.rolePermissions.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
      }),
    ]);

    revalidatePath('/dashboard/users');

    return { id: roleId };
  });
}

export async function createRole(
  name: string,
  description: string | null
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('roles.edit');
    const data = roleFormSchema.parse({ name, description: description ?? '' });

    const role = await prisma.authRole.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        isSystem: false,
        enterpriseId,
      },
      select: { id: true },
    });

    revalidatePath('/dashboard/users');

    return role;
  });
}

export async function deleteRole(id: string): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('roles.edit');

    // Papel de sistema não é desta empresa: o filtro por `enterpriseId` já o
    // deixa de fora, e o resultado é um `notFound` em vez de uma exclusão.
    const role = await prisma.authRole.findFirst({
      where: { id, enterpriseId, isSystem: false },
      select: { id: true },
    });

    if (!role) {
      throw new AppError('notFound');
    }

    const holders = await prisma.authUser.count({ where: { roleId: id, deletedAt: null } });

    if (holders > 0) {
      throw new AppError('inUse');
    }

    await prisma.$transaction([
      prisma.rolePermissions.deleteMany({ where: { roleId: id } }),
      prisma.authRole.delete({ where: { id } }),
    ]);

    revalidatePath('/dashboard/users');

    return { id };
  });
}
