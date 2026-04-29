import RequestType from '../RequestType';
import Horoscope from '../../models/Horoscope';

export type UpdateHoroscopeBody = Pick<
  Horoscope,
  'name' | 'timezone' | 'location' | 'chartData'
> & {
  /** @format date-time */
  birthTime: string;
};

type UpdateHoroscopeRequest = RequestType<UpdateHoroscopeBody, { id: string }>;

export default UpdateHoroscopeRequest;
