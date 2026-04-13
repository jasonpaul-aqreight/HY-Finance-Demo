import { z } from 'zod/v4';

export const createSaleRecordSchema = z.object({
  doc_date: z.iso.datetime().transform((s) => new Date(s)),
  net_total: z.number().positive(),
  doc_type: z.enum(['IV', 'CS', 'CN']),
  customer_id: z.string().uuid().optional(),
});

export type CreateSaleRecordInput = z.infer<typeof createSaleRecordSchema>;
