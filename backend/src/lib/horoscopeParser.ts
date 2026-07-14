import { execFile } from 'child_process';
import { promisify } from 'util';
import { addYears, format } from 'date-fns';
import { rawTimeZones } from '@vvo/tzdb';
import config from '../config/config';
import { badRequest, internalServerError } from '../errors';
import logger from './logger';
import ChartData from '../models/ChartData';

const execFileAsync = promisify(execFile);

const offsetToIana = (offsetStr: string): string | null => {
  // Parse "+5:30", "-8:00", "+05:30" etc. into total minutes
  const m = offsetStr.match(/^([+-]?)(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const minutes = sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
  const match = rawTimeZones.find((tz) => tz.rawOffsetInMinutes === minutes);
  return match?.name ?? null;
};

const normalizeTimezone = (raw: string): string => {
  // Strip OCR seconds artifact — matches "+H:MM:SS" or "+H:MM.SS" patterns only when
  // there are already two colon-separated groups (i.e. don't strip the minutes)
  const cleaned = raw.trim().replace(/^([+-]?\d{1,2}:\d{2})[:.]\d+$/, '$1');
  return offsetToIana(cleaned) ?? cleaned;
};

const combineDatetime = (date: string, time: string): string => {
  // date: "DD-MM-YYYY", time: "HH:MM:SS"
  const [dd, mm, yyyy] = date.split('-');
  const [hh, min, ss] = time.split(':');
  return format(new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss), "yyyy-MM-dd'T'HH:mm:ss");
};

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

    const parsed = JSON.parse(stdout) as ParsedHoroscope;

    const rawDashas = parsed.chartData.dashas as unknown as Array<{
      lord: ChartData['dashas'][0]['lord'];
      startDate: string;
      startTime: string;
    }>;

    parsed.chartData.dashas = rawDashas.map((d, i) => {
      const startDate = combineDatetime(d.startDate, d.startTime);
      const next = rawDashas[i + 1];

      const endDate = next
        ? combineDatetime(next.startDate, next.startTime)
        : format(addYears(new Date(startDate), 120), "yyyy-MM-dd'T'HH:mm:ss");

      return { lord: d.lord, startDate, endDate, subDashaPeriods: [] };
    });

    if (parsed.timezone) parsed.timezone = normalizeTimezone(parsed.timezone);

    return parsed;
  } catch (err) {
    const e = err as { code?: number; stderr?: string; signal?: string; message?: string };
    logger.error({ err: e }, 'PDF parse failed');
    if (e.signal === 'SIGTERM') throw badRequest('PDF parse timed out');
    if (e.code === 1) throw badRequest(`${(e.stderr ?? '').trim().slice(0, 200)}`);
    throw internalServerError('PDF parse failed');
  }
};
