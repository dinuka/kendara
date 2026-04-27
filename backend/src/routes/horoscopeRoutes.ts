import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import HoroscopeController from '../controllers/HoroscopeController';
import AuthUser from '../types/AuthUser';
import { isAppError } from '../errors';
import { compileRequestValidator, compileResponseValidator } from '../lib/validate';
import { CreateHoroscopeBody } from '../types/horoscope/CreateHoroscopeRequest';
import { CreateHoroscopeData } from '../types/horoscope/CreateHoroscopeResponse';
import { ListHoroscopesData } from '../types/horoscope/ListHoroscopesResponse';
import { GetHoroscopeData } from '../types/horoscope/GetHoroscopeResponse';
import { UpdateHoroscopeBody } from '../types/horoscope/UpdateHoroscopeRequest';
import { UpdateHoroscopeData } from '../types/horoscope/UpdateHoroscopeResponse';
import { DeleteHoroscopeData } from '../types/horoscope/DeleteHoroscopeResponse';
import {
  createHoroscopeBodySchema,
  createHoroscopeDataSchema,
  listHoroscopesDataSchema,
  getHoroscopeDataSchema,
  updateHoroscopeBodySchema,
  updateHoroscopeDataSchema,
  deleteHoroscopeDataSchema,
} from '../schemas/generated';

const validateCreateBody = compileRequestValidator<CreateHoroscopeBody>(createHoroscopeBodySchema);
const validateCreateData = compileResponseValidator<CreateHoroscopeData>(createHoroscopeDataSchema);
const validateListData = compileResponseValidator<ListHoroscopesData>(listHoroscopesDataSchema);
const validateGetData = compileResponseValidator<GetHoroscopeData>(getHoroscopeDataSchema);
const validateUpdateBody = compileRequestValidator<UpdateHoroscopeBody>(updateHoroscopeBodySchema);
const validateUpdateData = compileResponseValidator<UpdateHoroscopeData>(updateHoroscopeDataSchema);
const validateDeleteData = compileResponseValidator<DeleteHoroscopeData>(deleteHoroscopeDataSchema);

const getAuthUser = (req: Request): AuthUser =>
  (req as Request & { authUser: AuthUser }).authUser;

export const makeHoroscopeRouter = (
  controller: HoroscopeController,
  authMiddleware: RequestHandler
): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validateCreateBody(req.body);
      const result = await controller.create({ body }, getAuthUser(req));
      if (result.data !== undefined) validateCreateData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.list(getAuthUser(req));
      if (result.data !== undefined) validateListData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.get({ body: undefined as never, params: { id: String(req.params.id) } }, getAuthUser(req));
      if (result.data !== undefined) validateGetData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validateUpdateBody(req.body);
      const result = await controller.update({ body, params: { id: String(req.params.id) } }, getAuthUser(req));
      if (result.data !== undefined) validateUpdateData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.delete({ body: undefined as never, params: { id: String(req.params.id) } }, getAuthUser(req));
      if (result.data !== undefined) validateDeleteData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  return router;
};
