import Horoscope from '../../models/Horoscope';
import ActionResponse from '../ActionResponse';

export type GetHoroscopeData = { horoscope: Horoscope };

type GetHoroscopeResponse = ActionResponse<GetHoroscopeData>;

export default GetHoroscopeResponse;
