import { z } from 'zod/v4';
export declare const createSaleRecordSchema: z.ZodObject<{
    doc_date: z.ZodPipe<z.ZodISODateTime, z.ZodTransform<Date, string>>;
    net_total: z.ZodNumber;
    doc_type: z.ZodEnum<{
        IV: "IV";
        CS: "CS";
        CN: "CN";
    }>;
    customer_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateSaleRecordInput = z.infer<typeof createSaleRecordSchema>;
//# sourceMappingURL=finance.validation.d.ts.map