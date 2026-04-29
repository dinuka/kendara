import User from './User';
import ChartData from './ChartData';

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
  chartData?: ChartData;
  createdAt: Date;
  updatedAt: Date;
}

export default Horoscope;
