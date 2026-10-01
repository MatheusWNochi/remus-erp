import { z } from 'zod';

/** Campo de texto opcional: string vazia do formulário vira `null` no banco. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const movementFormSchema = z
  .object({
    productId: z.uuid('product'),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z.number('quantity'),
    reason: optionalText,
    reference: optionalText,
  })
  .superRefine((data, ctx) => {
    // Entrada e saída são gravadas positivas (o sinal vem do tipo) e o ajuste
    // carrega o próprio sinal. Há um CHECK no banco com a mesma regra — barrar
    // aqui transforma um erro cru do Postgres numa mensagem de campo.
    if (data.type === 'ADJUSTMENT') {
      if (data.quantity === 0) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'quantity' });
      }

      return;
    }

    if (data.quantity <= 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'quantityPositive' });
    }
  });

export type MovementFormValues = z.input<typeof movementFormSchema>;
export type MovementFormPayload = z.output<typeof movementFormSchema>;

export const stockBalanceParamsSchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().default('ALL'),
  level: z.enum(['OK', 'LOW', 'OUT', 'EXCESS', 'ALL']).default('ALL'),
  lowStock: z.boolean().default(false),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const movementListParamsSchema = z.object({
  search: z.string().trim().optional(),
  productId: z.string().trim().default('ALL'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'ALL']).default('ALL'),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});
