export enum ErrorCodes {
  BadRequest = 'BAD_REQUEST',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}

export type AppError = {
  code: ErrorCodes;
  message: string;
};

export const badRequest = (message = 'Bad request'): AppError => ({
  code: ErrorCodes.BadRequest,
  message,
});

export const forbidden = (message = 'Forbidden'): AppError => ({
  code: ErrorCodes.Forbidden,
  message,
});

export const notFound = (message = 'Not found'): AppError => ({
  code: ErrorCodes.NotFound,
  message,
});

export const internalServerError = (message = 'Internal server error'): AppError => ({
  code: ErrorCodes.InternalServerError,
  message,
});

export const isAppError = (err: unknown): err is AppError =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  Object.values(ErrorCodes).includes((err as AppError).code);
