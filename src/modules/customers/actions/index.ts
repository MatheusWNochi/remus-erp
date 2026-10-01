'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { action, type ActionResult } from '@/lib/server/action';
import { AppError, requirePermission } from '@/lib/server/session';
import type { Prisma } from '@/generated/prisma/client';
import type {
  CustomerDetail,
  CustomerListItem,
  CustomerListParams,
  CustomerListResult,
} from '../types';
import { customerFormSchema, customerListParamsSchema, type CustomerFormValues } from './schema';

const LIST_SELECT = {
  id: true,
  name: true,
  personType: true,
  document: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  status: true,
  createdAt: true,
} satisfies Prisma.customerSelect;

const SORTABLE_FIELDS = new Set(['name', 'document', 'email', 'city', 'status', 'createdAt']);

function toListItem(row: {
  id: string;
  name: string;
  personType: CustomerListItem['personType'];
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: CustomerListItem['status'];
  createdAt: Date;
}): CustomerListItem {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listCustomers(
  params: CustomerListParams
): Promise<ActionResult<CustomerListResult>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.view');
    const input = customerListParamsSchema.parse(params);

    const where: Prisma.customerWhereInput = {
      enterpriseId,
      deletedAt: null,
      ...(input.status !== 'ALL' ? { status: input.status } : {}),
      ...(input.state !== 'ALL' ? { state: input.state } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
              // O documento é gravado só com dígitos, então a busca também
              // precisa ignorar a máscara que o usuário digitou.
              { document: { contains: input.search.replace(/\D/g, '') || input.search } },
            ],
          }
        : {}),
    };

    const sortField =
      input.sortField && SORTABLE_FIELDS.has(input.sortField) ? input.sortField : 'createdAt';
    const sortDirection = input.sortDirection ?? 'desc';

    const [rows, total, states] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [sortField]: sortDirection },
        skip: input.page * input.pageSize,
        take: input.pageSize,
      }),
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where: { enterpriseId, deletedAt: null, state: { not: null } },
        select: { state: true },
        distinct: ['state'],
        orderBy: { state: 'asc' },
      }),
    ]);

    return {
      rows: rows.map(toListItem),
      total,
      states: states.map((row) => row.state).filter((state): state is string => Boolean(state)),
    };
  });
}

export async function getCustomer(id: string): Promise<ActionResult<CustomerDetail>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.view');

    const customer = await prisma.customer.findFirst({
      where: { id, enterpriseId, deletedAt: null },
    });

    if (!customer) {
      throw new AppError('notFound');
    }

    return {
      ...toListItem(customer),
      zipCode: customer.zipCode,
      street: customer.street,
      number: customer.number,
      complement: customer.complement,
      district: customer.district,
      notes: customer.notes,
      updatedAt: customer.updatedAt.toISOString(),
    };
  });
}

export async function createCustomer(
  values: CustomerFormValues
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('customers.create');
    const data = customerFormSchema.parse(values);

    const customer = await prisma.customer.create({
      data: { ...data, enterpriseId, createdBy: userId },
      select: { id: true },
    });

    revalidatePath('/dashboard/customers');

    return customer;
  });
}

export async function updateCustomer(
  id: string,
  values: CustomerFormValues
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.edit');
    const data = customerFormSchema.parse(values);

    // `updateMany` + filtro por enterprise garante que um id de outro tenant
    // simplesmente não encontre nada, em vez de atualizar o registro alheio.
    const result = await prisma.customer.updateMany({
      where: { id, enterpriseId, deletedAt: null },
      data: { ...data, updatedAt: new Date() },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/customers');

    return { id };
  });
}

export async function deleteCustomer(id: string): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId, userId } = await requirePermission('customers.delete');

    const result = await prisma.customer.updateMany({
      where: { id, enterpriseId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: userId },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/customers');

    return { id };
  });
}

/** Desfaz uma exclusão recente (toast "Desfazer"). */
export async function restoreCustomer(id: string): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.delete');

    const result = await prisma.customer.updateMany({
      where: { id, enterpriseId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedBy: null },
    });

    if (result.count === 0) {
      throw new AppError('notFound');
    }

    revalidatePath('/dashboard/customers');

    return { id };
  });
}

export async function setCustomersStatus(
  ids: string[],
  status: 'ACTIVE' | 'INACTIVE'
): Promise<ActionResult<{ count: number }>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.edit');

    if (ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.customer.updateMany({
      where: { id: { in: ids }, enterpriseId, deletedAt: null },
      data: { status, updatedAt: new Date() },
    });

    revalidatePath('/dashboard/customers');

    return { count: result.count };
  });
}

/**
 * Exporta a seleção (ou o resultado filtrado inteiro, se nada estiver
 * selecionado) como linhas prontas para virar CSV no client.
 */
export async function exportCustomers(
  params: CustomerListParams,
  ids?: string[]
): Promise<ActionResult<CustomerListItem[]>> {
  return action(async () => {
    const { enterpriseId } = await requirePermission('customers.export');
    const input = customerListParamsSchema.parse(params);

    const where: Prisma.customerWhereInput = {
      enterpriseId,
      deletedAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      ...(input.status !== 'ALL' ? { status: input.status } : {}),
      ...(input.state !== 'ALL' ? { state: input.state } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
              { document: { contains: input.search.replace(/\D/g, '') || input.search } },
            ],
          }
        : {}),
    };

    const rows = await prisma.customer.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { name: 'asc' },
      take: 5000,
    });

    return rows.map(toListItem);
  });
}
