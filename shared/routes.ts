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
    rates: {
      method: 'GET' as const,
      path: '/api/payments/rates' as const,
      responses: {
        200: z.object({ rates: z.record(z.number()) }),
        500: z.object({ message: z.string() }),
      },
    },
    init: {
      method: 'POST' as const,
      path: '/api/payments/init' as const,
      input: z.object({
        email: z.string().email(),
        country: z.string().length(2),
        amountKes: z.number().min(100).optional(),
        name: z.string().max(255).optional(),
        message: z.string().max(500).optional(),
      }),
      responses: {
        200: z.object({
          authorizationUrl: z.string(),
          reference: z.string(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    mobilemoney: {
      method: 'POST' as const,
      path: '/api/payments/mobilemoney' as const,
      input: z.object({
        email: z.string().email().optional(),
        phone: z.string().min(9).max(15),
        provider: z.string(),
        country: z.string().length(2),
        amountKes: z.number().min(100).optional(),
        name: z.string().max(255).optional(),
        message: z.string().max(500).optional(),
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
    checkMobileMoney: {
      method: 'GET' as const,
      path: '/api/payments/mobilemoney/:reference' as const,
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
