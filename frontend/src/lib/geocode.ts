import config from './config';

export type GeocodeResult = { latitude: number; longitude: number; label: string };

type NominatimResult = {
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
};

const buildLabel = (address: NominatimResult['address']): string => {
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? '';
  return [city, address.country].filter(Boolean).join(', ');
};

export const geocode = async (query: string): Promise<GeocodeResult[]> => {
  if (query.length < 2) return [];
  const url = `${config.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=5&featuretype=city&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  const data: NominatimResult[] = await res.json();
  return data
    .map(({ lat, lon, address }) => ({
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      label: buildLabel(address),
    }))
    .filter((r) => r.label.length > 0);
};
