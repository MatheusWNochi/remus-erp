import { z } from 'zod';

/** Campo de texto opcional: string vazia do formulário vira `null` no banco. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/**
 * Campo numérico do formulário. O input devolve string e o usuário em pt-BR
 * digita vírgula; normalizar aqui evita um `NaN` silencioso chegando ao
 * `Decimal` do Prisma. A faixa válida é checada no `superRefine`.
 */
const numberField = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? value : Number(value.replace(',', '.').trim())));

const optionalNumberField = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const text = typeof value === 'number' ? String(value) : value.replace(',', '.').trim();

    return text === '' ? null : Number(text);
  });

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'name'),
    sku: z.string().trim().min(1, 'sku'),
    categoryId: optionalText,
    unit: z.string().trim().default('UN'),
    costPrice: numberField,
    salePrice: numberField,
    minStock: numberField,
    maxStock: optionalNumberField,
    description: optionalText,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    for (const field of ['costPrice', 'salePrice', 'minStock'] as const) {
      if (!Number.isFinite(data[field]) || data[field] < 0) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'price' });
      }
    }

    if (data.maxStock !== null && (!Number.isFinite(data.maxStock) || data.maxStock < 0)) {
      ctx.addIssue({ code: 'custom', path: ['maxStock'], message: 'price' });
    }

    // Máximo abaixo do mínimo deixaria o produto preso em "excesso" e "baixo"
    // ao mesmo tempo — a classificação de estoque nunca faria sentido.
    if (
      data.maxStock !== null &&
      Number.isFinite(data.maxStock) &&
      data.maxStock <= data.minStock
    ) {
      ctx.addIssue({ code: 'custom', path: ['maxStock'], message: 'maxStock' });
    }
  })
  .transform((data) => ({
    ...data,
    // SKU é código, não texto livre: normalizar evita "abc-1" e "ABC-1" como
    // dois produtos diferentes no catálogo.
    sku: data.sku.toUpperCase(),
    unit: (data.unit || 'UN').toUpperCase(),
  }));

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormPayload = z.output<typeof productFormSchema>;

export const productListParamsSchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().default('ALL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
  lowStock: z.boolean().default(false),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'name'),
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
