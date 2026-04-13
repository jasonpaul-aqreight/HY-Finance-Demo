import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const financeService = {
  async getSalesDaily(from?: Date, to?: Date) {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.doc_date = {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      };
    }

    return prisma.spike_pc_sales_daily.findMany({
      where,
      orderBy: { doc_date: 'desc' },
      take: 50,
    });
  },

  async createSaleRecord(data: {
    doc_date: Date;
    net_total: number;
    doc_type: string;
    customer_id?: string;
  }) {
    return prisma.spike_pc_sales_daily.create({
      data: {
        doc_date: data.doc_date,
        net_total: data.net_total,
        doc_type: data.doc_type,
        customer_id: data.customer_id,
      },
    });
  },

  async getSettings() {
    return prisma.spike_app_setting.findMany();
  },
};
