import 'server-only';

import { ZodError } from 'zod';

import { Prisma } from '@/generated/prisma/client';
import { AppError } from './session';

/**
 * Toda server action devolve este formato em vez de lançar: o erro chega à
 * tela como uma chave de tradução (namespace `Errors`), nunca como stack
 * trace ou mensagem do Postgres.
 *
 * `fieldErrors` mapeia campo -> chave de erro do próprio módulo
 * (ex: `document` -> `Customers.errors.document`), para o formulário marcar o
 * campo em vez de mostrar um toast genérico.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(errorKey: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error: errorKey, fieldErrors };
}

/**
 * Envelopa o corpo de uma action, traduzindo exceções conhecidas em chaves.
 * Erros inesperados viram `unexpected` e vão para o log do servidor — o
 * usuário não deve ver detalhe de infraestrutura.
 */
export async function action<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await run());
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message);
    }

    // Os schemas usam a chave de tradução como `message` (ex: 'document'),
    // então o formulário consegue marcar o campo certo. Sem isto, uma falha
    // de validação viraria "algo deu errado".
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};

      for (const issue of error.issues) {
        const field = issue.path[0];

        if (typeof field === 'string' && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }

      return fail('validation', fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = violação de índice único (SKU ou documento repetido).
      if (error.code === 'P2002') {
        return fail('duplicate');
      }
      // P2003 = violação de chave estrangeira.
      if (error.code === 'P2003') {
        return fail('inUse');
      }
    }

    console.error('[action]', error);
    return fail('unexpected');
  }
}
