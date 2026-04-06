import type { Request, Response } from 'express';
import { financeService } from './finance.service.js';

export const financeController = {
  async getSalesDaily(req: Request, res: Response): Promise<void> {
    const { from, to } = req.query;
    const data = await financeService.getSalesDaily(
      from ? new Date(from as string) : undefined,
      to ? new Date(to as string) : undefined,
    );
    res.json({ data, count: data.length });
  },

  async createSaleRecord(req: Request, res: Response): Promise<void> {
    // req.body is already validated by Zod middleware at this point
    const record = await financeService.createSaleRecord(req.body);
    res.status(201).json({ data: record });
  },

  async getSettings(req: Request, res: Response): Promise<void> {
    const settings = await financeService.getSettings();
    res.json({ data: settings });
  },
};
