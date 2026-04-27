import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config/config';
import { connectClient } from './config/db';
import UserRepo from './repos/UserRepo';
import HoroscopeRepo from './repos/HoroscopeRepo';
import AuthController from './controllers/AuthController';
import HoroscopeController from './controllers/HoroscopeController';
import { makeAuthRouter } from './routes/authRoutes';
import { makeHoroscopeRouter } from './routes/horoscopeRoutes';
import { makeAuthMiddleware } from './middleware/authMiddleware';
import { internalServerError } from './errors';
import logger from './lib/logger';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  const db = await connectClient(config.mongoUri, config.mongoDbName);

  const userRepo = new UserRepo(db);
  const horoscopeRepo = new HoroscopeRepo(db);

  const authController = new AuthController(userRepo);
  const horoscopeController = new HoroscopeController(horoscopeRepo);
  const authMiddleware = makeAuthMiddleware(userRepo);

  app.use('/api/auth', makeAuthRouter(authController));
  app.use('/api/horoscopes', makeHoroscopeRouter(horoscopeController, authMiddleware));

  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const err = internalServerError();
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
  });

  app.listen(config.port, () => logger.info(`Server running on http://localhost:${config.port}`));
};

start();
