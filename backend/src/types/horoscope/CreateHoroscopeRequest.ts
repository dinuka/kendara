import RequestType from '../RequestType';
import Horoscope from '../../models/Horoscope';
import ChartData from '../../models/ChartData';

export type CreateHoroscopeBody = Pick<
  Horoscope,
  'name' | 'timezone' | 'location'
> & {
  /** @format date-time */
  birthTime: string;
  chartData?: ChartData;
};

type CreateHoroscopeRequest = RequestType<CreateHoroscopeBody>;

export default CreateHoroscopeRequest;
