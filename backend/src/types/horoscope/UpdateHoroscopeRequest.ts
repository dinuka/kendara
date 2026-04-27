import RequestType from '../RequestType';

export type UpdateHoroscopeBody = {
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

type UpdateHoroscopeRequest = RequestType<UpdateHoroscopeBody, { id: string }>;

export default UpdateHoroscopeRequest;
