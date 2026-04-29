import ActionResponse from '../ActionResponse';
import { HoroscopePopulated } from '../../models/HoroscopePopulated';

export type CreateHoroscopeData = { horoscope: HoroscopePopulated };

type CreateHoroscopeResponse = ActionResponse<CreateHoroscopeData>;

export default CreateHoroscopeResponse;
