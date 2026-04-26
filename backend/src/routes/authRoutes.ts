import { Router, Request, Response, NextFunction } from 'express';
import AuthController from '../controllers/AuthController';
import { isAppError } from '../errors';
import { compileRequestValidator, compileResponseValidator } from '../lib/validate';
import { SyncUserBody } from '../types/auth/SyncUserRequest';
import { SyncUserData } from '../types/auth/SyncUserResponse';
import { syncUserBodySchema, syncUserDataSchema } from '../schemas/generated';

const validateRequest = compileRequestValidator<SyncUserBody>(syncUserBodySchema);
const validateResponse = compileResponseValidator<SyncUserData>(syncUserDataSchema);

export const makeAuthRouter = (controller: AuthController): Router => {
  const router = Router();

  router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validateRequest(req.body);

      const result = await controller.syncUser({ body });

      if (result.data !== undefined) {
        validateResponse(JSON.parse(JSON.stringify(result.data)));
      }

      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      } else {
        next(err);
      }
    }
  });

  return router;
};
