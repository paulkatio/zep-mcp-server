import { z } from 'zod';

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

/** Offset pagination. */
export const PaginationInput = z
  .object({
    limit: z.number().int().min(1).max(100).optional().describe('Items per page (1–100).'),
    page: z.number().int().min(1).optional().describe('1-based page number.'),
  })
  .strict();

/** Auto-pagination toggle for list tools. */
export const AutoPaginateInput = z
  .object({
    auto_paginate: z
      .boolean()
      .optional()
      .describe('If true, load all pages up to max_items (hard cap 500). Default false.'),
    max_items: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('Max items when auto_paginate=true. Default 100, hard cap 500.'),
  })
  .strict();

/** Numeric id[] filter (serialized as id[]=). */
export const IdFilterInput = z
  .object({
    id: z
      .array(z.number().int().positive())
      .optional()
      .describe('Filter by one or more numeric IDs (serialized as id[]=).'),
  })
  .strict();

/** YYYY-MM-DD date range filter. */
export const DateRangeInput = z
  .object({
    start_date: z.string().regex(DATE_REGEX).optional().describe('Start date, YYYY-MM-DD.'),
    end_date: z.string().regex(DATE_REGEX).optional().describe('End date, YYYY-MM-DD.'),
  })
  .strict();
