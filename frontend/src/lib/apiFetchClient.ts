'use client';
import { getSession } from 'next-auth/react';
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

const apiFetchClient = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const session = await getSession();
  if (!session?.idToken) throw forbidden('Not authenticated');

  const isFormData = init.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${session.idToken}`,
  };
  if (!isFormData) baseHeaders['Content-Type'] = 'application/json';

  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
  });

  const json = await res.json();
  if (!res.ok) {
    const serverError = json?.error;
    if (isAppError(serverError)) {
      logger.error(serverError, 'apiFetchClient error');
      throw mapServerError(serverError);
    }
    throw internalServerError();
  }
  return json.data as T;
};

export default apiFetchClient;
