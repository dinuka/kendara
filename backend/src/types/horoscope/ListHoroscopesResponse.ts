import ActionResponse from '../ActionResponse';
import { HoroscopePopulated } from '../../models/HoroscopePopulated';

export type ListHoroscopesData = { horoscopes: HoroscopePopulated[] };

type ListHoroscopesResponse = ActionResponse<ListHoroscopesData>;

export default ListHoroscopesResponse;
