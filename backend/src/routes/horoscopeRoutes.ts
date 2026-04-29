import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import os from 'os';
import { randomUUID } from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import HoroscopeController from '../controllers/HoroscopeController';
import AuthUser from '../types/AuthUser';
import { isAppError, ErrorCodes } from '../errors';
import config from '../config/config';
import { compileRequestValidator, compileResponseValidator } from '../lib/validate';
import { CreateHoroscopeBody } from '../types/horoscope/CreateHoroscopeRequest';
import { CreateHoroscopeData } from '../types/horoscope/CreateHoroscopeResponse';
import { ListHoroscopesData } from '../types/horoscope/ListHoroscopesResponse';
import { GetHoroscopeData } from '../types/horoscope/GetHoroscopeResponse';
import { UpdateHoroscopeBody } from '../types/horoscope/UpdateHoroscopeRequest';
import { UpdateHoroscopeData } from '../types/horoscope/UpdateHoroscopeResponse';
import { DeleteHoroscopeData } from '../types/horoscope/DeleteHoroscopeResponse';
import { ParseHoroscopePdfData } from '../types/horoscope/ParseHoroscopePdfResponse';
import {
  createHoroscopeBodySchema,
  createHoroscopeDataSchema,
  listHoroscopesDataSchema,
  getHoroscopeDataSchema,
  updateHoroscopeBodySchema,
  updateHoroscopeDataSchema,
  deleteHoroscopeDataSchema,
  parseHoroscopePdfDataSchema,
} from '../schemas/generated';

const validateCreateBody = compileRequestValidator<CreateHoroscopeBody>(createHoroscopeBodySchema);
const validateCreateData = compileResponseValidator<CreateHoroscopeData>(createHoroscopeDataSchema);
const validateListData = compileResponseValidator<ListHoroscopesData>(listHoroscopesDataSchema);
const validateGetData = compileResponseValidator<GetHoroscopeData>(getHoroscopeDataSchema);
const validateUpdateBody = compileRequestValidator<UpdateHoroscopeBody>(updateHoroscopeBodySchema);
const validateUpdateData = compileResponseValidator<UpdateHoroscopeData>(updateHoroscopeDataSchema);
const validateDeleteData = compileResponseValidator<DeleteHoroscopeData>(deleteHoroscopeDataSchema);
const validateParsePdfData = compileResponseValidator<ParseHoroscopePdfData>(
  parseHoroscopePdfDataSchema
);

const getAuthUser = (req: Request): AuthUser => (req as Request & { authUser: AuthUser }).authUser;

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}-${path.basename(file.originalname)}`),
  }),
  limits: { fileSize: config.parsePdfMaxFileSize, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
      return;
    }
    cb(null, true);
  },
});

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
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.list(getAuthUser(req));
      if (result.data !== undefined) validateListData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.get(
        { body: undefined as never, params: { id: String(req.params.id) } },
        getAuthUser(req)
      );
      if (result.data !== undefined) validateGetData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validateUpdateBody(req.body);
      const result = await controller.update(
        { body, params: { id: String(req.params.id) } },
        getAuthUser(req)
      );
      if (result.data !== undefined) validateUpdateData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller.delete(
        { body: undefined as never, params: { id: String(req.params.id) } },
        getAuthUser(req)
      );
      if (result.data !== undefined) validateDeleteData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  router.post(
    '/parse-pdf',
    upload.single('pdf'),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.file) {
        res.status(400).json({
          error: { code: ErrorCodes.BadRequest, message: 'Missing file under field name "pdf"' },
        });
        return;
      }
      try {
        const result = await controller.parsePdf({ filePath: req.file.path });
        if (result.data !== undefined)
          validateParsePdfData(JSON.parse(JSON.stringify(result.data)));
        res.status(result.status).json({ data: result.data });
      } catch (err) {
        if (isAppError(err)) {
          res.status(err.status).json({ error: { code: err.code, message: err.message } });
        } else {
          next(err);
        }
      } finally {
        if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
      }
    }
  );

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
      res.status(400).json({ error: { code: ErrorCodes.BadRequest, message } });
      return;
    }
    if (err instanceof Error && err.message === 'Only PDF files are accepted') {
      res.status(400).json({ error: { code: ErrorCodes.BadRequest, message: err.message } });
      return;
    }
    next(err);
  });

  return router;
};
