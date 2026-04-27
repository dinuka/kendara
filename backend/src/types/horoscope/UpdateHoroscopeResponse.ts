import Horoscope from '../../models/Horoscope';
import ActionResponse from '../ActionResponse';

export type UpdateHoroscopeData = { horoscope: Horoscope };

type UpdateHoroscopeResponse = ActionResponse<UpdateHoroscopeData>;

export default UpdateHoroscopeResponse;
