import Horoscope from '../../models/Horoscope';
import ActionResponse from '../ActionResponse';

export type ListHoroscopesData = { horoscopes: Horoscope[] };

type ListHoroscopesResponse = ActionResponse<ListHoroscopesData>;

export default ListHoroscopesResponse;
