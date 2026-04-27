import RequestType from '../RequestType';

type GetHoroscopeRequest = RequestType<never, { id: string }>;

export default GetHoroscopeRequest;
