import { financeService } from './finance.service.js';
export const financeController = {
    async getSalesDaily(req, res) {
        const { from, to } = req.query;
        const data = await financeService.getSalesDaily(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
        res.json({ data, count: data.length });
    },
    async createSaleRecord(req, res) {
        // req.body is already validated by Zod middleware at this point
        const record = await financeService.createSaleRecord(req.body);
        res.status(201).json({ data: record });
    },
    async getSettings(req, res) {
        const settings = await financeService.getSettings();
        res.json({ data: settings });
    },
};
//# sourceMappingURL=finance.controller.js.map