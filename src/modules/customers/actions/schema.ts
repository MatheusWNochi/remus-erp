import { z } from 'zod';

import { isValidDocument } from '@/utils/document';
import { onlyDigits } from '@/utils/format';

/** Campo de texto opcional: string vazia do formulário vira `null` no banco. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const customerFormSchema = z
  .object({
    name: z.string().trim().min(1, 'name'),
    personType: z.enum(['INDIVIDUAL', 'COMPANY']),
    document: optionalText,
    email: optionalText,
    phone: optionalText,
    zipCode: optionalText,
    street: optionalText,
    number: optionalText,
    complement: optionalText,
    district: optionalText,
    city: optionalText,
    state: optionalText,
    notes: optionalText,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    // Documento é opcional, mas se informado precisa ter DV válido — senão o
    // erro só aparece lá na emissão da nota.
    if (data.document && !isValidDocument(data.document)) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'document' });
    }

    if (data.email && !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'email' });
    }

    if (data.state && data.state.trim().length !== 2) {
      ctx.addIssue({ code: 'custom', path: ['state'], message: 'state' });
    }
  })
  .transform((data) => ({
    ...data,
    document: data.document ? onlyDigits(data.document) : null,
    phone: data.phone ? onlyDigits(data.phone) : null,
    zipCode: data.zipCode ? onlyDigits(data.zipCode) : null,
    state: data.state ? data.state.trim().toUpperCase() : null,
    email: data.email ? data.email.trim().toLowerCase() : null,
  }));

export type CustomerFormValues = z.input<typeof customerFormSchema>;
export type CustomerFormPayload = z.output<typeof customerFormSchema>;

export const customerListParamsSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
  state: z.string().trim().default('ALL'),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});
