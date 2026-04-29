import RequestType from '../RequestType';
import Horoscope from '../../models/Horoscope';
import ChartData from '../../models/ChartData';

export type UpdateHoroscopeBody = Pick<
  Horoscope,
  'name' | 'timezone' | 'location'
> & {
  /** @format date-time */
  birthTime: string;
  chartData?: ChartData;
};

type UpdateHoroscopeRequest = RequestType<UpdateHoroscopeBody, { id: string }>;

export default UpdateHoroscopeRequest;
