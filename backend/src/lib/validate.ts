import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { badRequest, internalServerError } from '../errors';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const buildValidator = <T>(schema: Record<string, unknown>, onError: (msg: string) => never) => {
  const validate: ValidateFunction = ajv.compile(schema);

  return (data: unknown): T => {
    if (validate(data)) return data as T;

    const message = validate.errors
      ?.map((e) => `${e.instancePath || 'body'} ${e.message}`)
      .join('; ') ?? 'Validation failed';

    onError(message);
  };
};

export const compileRequestValidator = <T>(schema: Record<string, unknown>) =>
  buildValidator<T>(schema, (msg) => { throw badRequest(msg); });

export const compileResponseValidator = <T>(schema: Record<string, unknown>) =>
  buildValidator<T>(schema, (msg) => { throw internalServerError(msg); });
