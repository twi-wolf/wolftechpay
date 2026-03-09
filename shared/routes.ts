import { z } from 'zod';
import { transactions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  payments: {
    init: {
      method: 'POST' as const,
      path: '/api/payments/init' as const,
      input: z.object({ email: z.string().email() }),
      responses: {
        200: z.object({
          authorizationUrl: z.string(),
          reference: z.string()
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    stk: {
      method: 'POST' as const,
      path: '/api/payments/stk' as const,
      input: z.object({
        email: z.string().email(),
        phone: z.string().min(9).max(15),
      }),
      responses: {
        200: z.object({
          reference: z.string(),
          displayText: z.string(),
          status: z.string(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    checkStk: {
      method: 'GET' as const,
      path: '/api/payments/stk/:reference' as const,
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        404: z.object({ message: z.string() }),
        500: errorSchemas.internal,
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/payments/verify' as const,
      input: z.object({ reference: z.string() }),
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
        404: z.object({ message: z.string() }),
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
