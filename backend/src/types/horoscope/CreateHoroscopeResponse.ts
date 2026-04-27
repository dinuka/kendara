import Horoscope from '../../models/Horoscope';
import ActionResponse from '../ActionResponse';

export type CreateHoroscopeData = { horoscope: Horoscope };

type CreateHoroscopeResponse = ActionResponse<CreateHoroscopeData>;

export default CreateHoroscopeResponse;
