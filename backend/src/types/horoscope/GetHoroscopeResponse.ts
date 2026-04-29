import ActionResponse from '../ActionResponse';
import { HoroscopePopulated } from '../../models/HoroscopePopulated';

export type GetHoroscopeData = { horoscope: HoroscopePopulated };

type GetHoroscopeResponse = ActionResponse<GetHoroscopeData>;

export default GetHoroscopeResponse;
