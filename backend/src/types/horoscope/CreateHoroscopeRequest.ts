import RequestType from '../RequestType';

export type CreateHoroscopeBody = {
  name: string;
  /** @format date-time */
  birthTime: string;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
};

type CreateHoroscopeRequest = RequestType<CreateHoroscopeBody>;

export default CreateHoroscopeRequest;
