import ActionResponse from '../ActionResponse';
import { HoroscopePopulated } from '../../models/HoroscopePopulated';

export type UpdateHoroscopeData = { horoscope: HoroscopePopulated };

type UpdateHoroscopeResponse = ActionResponse<UpdateHoroscopeData>;

export default UpdateHoroscopeResponse;
