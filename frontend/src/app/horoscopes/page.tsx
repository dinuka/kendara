import apiFetch from '@/lib/apiFetch';
import HoroscopeListClient from './HoroscopeListClient';
import { Horoscope } from './types';

const HoroscopesPage = async () => {
  const { horoscopes } = await apiFetch<{ horoscopes: Horoscope[] }>('/api/horoscopes');
  return <HoroscopeListClient initial={horoscopes} />;
};

export default HoroscopesPage;
