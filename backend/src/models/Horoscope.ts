import User from './User';
import StoredChartData from './ChartDataStored';

interface Horoscope {
  id: string;
  owner: Pick<User, 'id'>;
  name: string;
  birthTime: Date;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  chartData?: StoredChartData;
  createdAt: Date;
  updatedAt: Date;
}

export default Horoscope;
