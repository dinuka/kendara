import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config/config';
import { badRequest, internalServerError } from '../errors';
import logger from './logger';
import ChartData from '../models/ChartData';

const execFileAsync = promisify(execFile);

export type ParsedHoroscope = Pick<
  import('../models/Horoscope').default,
  'name' | 'timezone' | 'location'
> & {
  birthDate: string;
  birthTimeOfDay: string;
  chartData: ChartData;
};

export const parseHoroscopePdf = async (pdfPath: string): Promise<ParsedHoroscope> => {
  try {
    const { stdout } = await execFileAsync(
      config.parserPythonPath,
      [config.parserScriptPath, pdfPath],
      { timeout: config.parsePdfTimeoutMs, maxBuffer: 20 * 1024 * 1024 }
    );
    return JSON.parse(stdout) as ParsedHoroscope;
  } catch (err) {
    const e = err as { code?: number; stderr?: string; signal?: string; message?: string };
    logger.error({ err: e }, 'PDF parse failed');
    if (e.signal === 'SIGTERM') throw badRequest('PDF parse timed out');
    if (e.code === 1) throw badRequest(`${(e.stderr ?? '').trim().slice(0, 200)}`);
    throw internalServerError('PDF parse failed');
  }
};
