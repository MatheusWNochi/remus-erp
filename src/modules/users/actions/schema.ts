import { z } from 'zod';

/** Mensagens são chaves nuas de `Users.errors.*` — a tela é quem traduz. */
export const userInviteSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName'),
  lastName: z.string().trim().min(1, 'lastName'),
  email: z
    .string()
    .trim()
    .email('email')
    .transform((value) => value.toLowerCase()),
  roleId: z.string().uuid('role'),
  password: z.string().min(8, 'password'),
});

/** Edição não mexe em e-mail nem em senha: identidade e credencial à parte. */
export const userEditSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName'),
  lastName: z.string().trim().min(1, 'lastName'),
  roleId: z.string().uuid('role'),
});

export type UserInviteValues = z.input<typeof userInviteSchema>;
export type UserEditValues = z.input<typeof userEditSchema>;

export const userListParamsSchema = z.object({
  search: z.string().trim().optional(),
  roleId: z.string().trim().default('ALL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'INVITED', 'ALL']).default('ALL'),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, 'name'),
  description: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .nullable(),
});
