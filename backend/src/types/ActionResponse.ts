import { ErrorCodes } from '../errors';

type ActionResponse<T> = {
  status: number;
  data?: T;
  error?: { code: ErrorCodes; message: string };
};

export default ActionResponse;
