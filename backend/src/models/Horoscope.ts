import User from './User';

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
  createdAt: Date;
  updatedAt: Date;
}

export default Horoscope;
