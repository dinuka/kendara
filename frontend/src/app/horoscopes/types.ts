export type Horoscope = {
  id: string;
  owner: { id: string };
  name: string;
  birthTime: string;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  createdAt: string;
  updatedAt: string;
};
