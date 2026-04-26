import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/config';
import { connectClient } from './config/db';
import UserRepo from './repos/UserRepo';
import AuthController from './controllers/AuthController';
import { makeAuthRouter } from './routes/authRoutes';
import { internalServerError } from './errors';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  const db = await connectClient(config.mongoUri, config.mongoDbName);

  const userRepo = new UserRepo(db);

  const authController = new AuthController(userRepo);

  app.use('/api/auth', makeAuthRouter(authController));

  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const err = internalServerError();
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
  });

  app.listen(config.port, () =>
    console.log(`[backend] Server running on http://localhost:${config.port}`)
  );
};

start();
