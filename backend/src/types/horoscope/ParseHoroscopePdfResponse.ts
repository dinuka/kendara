import ActionResponse from '../ActionResponse';
import { ParsedHoroscope } from '../../lib/horoscopeParser';

export type ParseHoroscopePdfData = {
  parsed: ParsedHoroscope;
};

type ParseHoroscopePdfResponse = ActionResponse<ParseHoroscopePdfData>;

export default ParseHoroscopePdfResponse;
