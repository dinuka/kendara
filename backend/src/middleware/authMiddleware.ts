import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/config';
import { ErrorCodes, forbidden, isAppError } from '../errors';
import UserRepo from '../repos/UserRepo';
import AuthUser from '../types/AuthUser';

const client = new OAuth2Client(config.googleClientId);

export const makeAuthMiddleware =
  (userRepo: UserRepo) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw forbidden('Missing bearer token');
      const idToken = header.slice('Bearer '.length);

      const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw forbidden('Invalid Google token');

      const user = await userRepo.findByGoogleId(payload.sub);
      if (!user) throw forbidden('User not synced');

      (req as Request & { authUser: AuthUser }).authUser = user;
      next();
    } catch (err) {
      if (isAppError(err)) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      } else {
        res.status(403).json({ error: { code: ErrorCodes.Forbidden, message: 'Auth failed' } });
      }
    }
  };
