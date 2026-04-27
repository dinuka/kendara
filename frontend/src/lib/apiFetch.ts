import { auth } from './auth';
import config from './config';
import { ErrorCodes, forbidden, internalServerError, isAppError, notFound } from './errors';
import logger from './logger';

const mapServerError = (serverError: { code: string; message: string }) => {
  switch (serverError.code) {
    case ErrorCodes.NotFound:
      return notFound();
    case ErrorCodes.Forbidden:
      return forbidden();
    default:
      return internalServerError();
  }
};

const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const session = await auth();
  if (!session?.idToken) throw forbidden('Not authenticated');

  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.idToken}`,
      ...(init.headers ?? {}),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    const serverError = json?.error;
    if (isAppError(serverError)) {
      logger.error(serverError, 'apiFetch error');
      throw mapServerError(serverError);
    }
    throw internalServerError();
  }
  return json.data as T;
};

export default apiFetch;
