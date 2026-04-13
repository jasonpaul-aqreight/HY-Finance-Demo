import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { authMiddleware } from './common/middlewares/auth.middleware.js';
import apiRoutes from './common/routes.index.js';

const logger = pino({ transport: { target: 'pino-pretty' } });

const app = express();
const PORT = process.env.PORT || 3001;

// Global middleware
app.use(helmet());
app.use(express.json());

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth middleware for all /api routes
app.use('/api/v1', authMiddleware, apiRoutes);

// Express 5 async error handling — Express 5 natively catches rejected promises
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`S2 spike server running on port ${PORT}`);
});

export default app;
