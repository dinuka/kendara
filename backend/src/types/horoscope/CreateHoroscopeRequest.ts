import RequestType from '../RequestType';
import Horoscope from '../../models/Horoscope';

export type CreateHoroscopeBody = Pick<
  Horoscope,
  'name' | 'timezone' | 'location' | 'chartData'
> & {
  /** @format date-time */
  birthTime: string;
};

type CreateHoroscopeRequest = RequestType<CreateHoroscopeBody>;

export default CreateHoroscopeRequest;
