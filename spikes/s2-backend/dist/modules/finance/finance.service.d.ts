export declare const financeService: {
    getSalesDaily(from?: Date, to?: Date): Promise<{
        id: string;
        doc_date: Date;
        net_total: import("@prisma/client/runtime/library").Decimal;
        doc_type: string;
        customer_id: string | null;
        created_at: Date;
    }[]>;
    createSaleRecord(data: {
        doc_date: Date;
        net_total: number;
        doc_type: string;
        customer_id?: string;
    }): Promise<{
        id: string;
        doc_date: Date;
        net_total: import("@prisma/client/runtime/library").Decimal;
        doc_type: string;
        customer_id: string | null;
        created_at: Date;
    }>;
    getSettings(): Promise<{
        id: string;
        key: string;
        value: string;
    }[]>;
};
//# sourceMappingURL=finance.service.d.ts.map