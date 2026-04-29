import Horoscope from '../models/Horoscope';
import ChartData from '../models/ChartData';

export interface HoroscopePopulated extends Omit<Horoscope, 'chartData'> {
  chartData?: ChartData;
}
