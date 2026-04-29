import { ParsedHoroscope } from '../types';

const KEY = 'kendara:horoscopes:import:parsed';

export const setParsedImport = (parsed: ParsedHoroscope) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {}
};

export const getParsedImport = (): ParsedHoroscope | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ParsedHoroscope) : null;
  } catch {
    return null;
  }
};

export const clearParsedImport = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
};
