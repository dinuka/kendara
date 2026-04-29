'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import apiFetchClient from '@/lib/apiFetchClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useToast } from '@/components/ui/toast';
import { geocode } from '@/lib/geocode';
import { ParsedHoroscope, DashaPeriod, PlanetaryPosition, CuspalPosition } from '../../types';
import { getParsedImport, clearParsedImport } from '../importStorage';

const timezones = Intl.supportedValuesOf('timeZone');

const DashaList = ({ periods }: { periods: DashaPeriod[] }) => (
  <ul className="ml-4 list-disc text-xs">
    {periods.map((p, i) => (
      <li key={`${p.lord.code}-${i}`}>
        <span>
          {p.lord.code} — {p.startDate} → {p.endDate}
        </span>
        {p.subDashaPeriods.length ? <DashaList periods={p.subDashaPeriods} /> : null}
      </li>
    ))}
  </ul>
);

const ImportReviewPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [parsed, setParsed] = React.useState<ParsedHoroscope | null>(null);
  const [name, setName] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [birthTimeOfDay, setBirthTimeOfDay] = React.useState('');
  const [timezone, setTimezone] = React.useState('');
  const [location, setLocation] = React.useState({ latitude: 0, longitude: 0, label: '' });
  const [saving, setSaving] = React.useState(false);
  const [timezoneQuery, setTimezoneQuery] = React.useState('');
  const [locationQuery, setLocationQuery] = React.useState('');
  const [locationOptions, setLocationOptions] = React.useState<ComboboxOption[]>([]);
  const [geocoding, setGeocoding] = React.useState(false);
  const [latInput, setLatInput] = React.useState('');
  const [lonInput, setLonInput] = React.useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredTimezones = React.useMemo(
    () =>
      timezoneQuery.length === 0
        ? timezones
        : timezones.filter((tz) => tz.toLowerCase().includes(timezoneQuery.toLowerCase())),
    [timezoneQuery]
  );

  React.useEffect(() => {
    const data = getParsedImport();
    if (!data) {
      router.replace('/horoscopes');
      return;
    }
    setParsed(data);
    setName(data.name);
    setBirthDate(data.birthDate);
    setBirthTimeOfDay(data.birthTimeOfDay);
    setTimezone(data.timezone);
    setTimezoneQuery(data.timezone);
    setLocation(data.location);
    setLocationQuery(data.location.label);
    setLatInput(String(data.location.latitude));
    setLonInput(String(data.location.longitude));
  }, [router]);

  const handleLocationInput = (value: string) => {
    setLocationQuery(value);
    setLocation({ ...location, label: '' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      const results = await geocode(value);
      setLocationOptions(
        results.map((r) => ({
          value: `${r.latitude},${r.longitude}`,
          label: r.label,
        }))
      );
      setGeocoding(false);
    }, 300);
  };

  const handleLocationSelect = (option: ComboboxOption) => {
    const [lat, lon] = option.value.split(',').map(Number);
    setLocation({ latitude: lat, longitude: lon, label: option.label });
    setLocationQuery(option.label);
    setLatInput(String(lat));
    setLonInput(String(lon));
    setLocationOptions([]);
  };

  const handleCancel = () => {
    clearParsedImport();
    router.push('/horoscopes');
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const body = {
        name,
        birthTime: new Date(`${birthDate}T${birthTimeOfDay}:00`).toISOString(),
        timezone,
        location,
        chartData: parsed.chartData,
      };
      await apiFetchClient('/api/horoscopes', { method: 'POST', body: JSON.stringify(body) });
      clearParsedImport();
      toast('Horoscope imported');
      router.push('/horoscopes');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!parsed) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Review imported horoscope</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        OCR may have errors. Edit the basic fields below before saving. Rich chart data is read-only
        this iteration — re-import or edit MongoDB directly if a value is wrong.
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Birth date &amp; time</Label>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <DateInput value={birthDate} onChange={setBirthDate} />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <TimeInput value={birthTimeOfDay} onChange={setBirthTimeOfDay} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Timezone</Label>
          <Combobox
            value={timezoneQuery}
            options={filteredTimezones.map((tz) => ({ value: tz, label: tz }))}
            onInputChange={(val) => {
              setTimezoneQuery(val);
              setTimezone('');
            }}
            onSelect={(option) => {
              setTimezoneQuery(option.value);
              setTimezone(option.value);
            }}
            placeholder="Search timezone…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Location</Label>
          <Combobox
            value={locationQuery}
            options={locationOptions}
            onInputChange={handleLocationInput}
            onSelect={handleLocationSelect}
            placeholder="Search for a city…"
            loading={geocoding}
          />
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Input
                placeholder="Latitude"
                value={latInput}
                onChange={(e) => {
                  setLatInput(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setLocation({ ...location, latitude: v });
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Input
                placeholder="Longitude"
                value={lonInput}
                onChange={(e) => {
                  setLonInput(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setLocation({ ...location, longitude: v });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Planetary Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>Planet</th>
                <th>Sign</th>
                <th>Degrees</th>
                <th>House</th>
                <th>STL</th>
                <th>SL</th>
                <th>SSL</th>
                <th>D/R</th>
              </tr>
            </thead>
            <tbody>
              {parsed.chartData.planetaryPositions.map((p: PlanetaryPosition) => (
                <tr key={p.planet.id}>
                  <td>{p.planet.code}</td>
                  <td>{p.sign.name}</td>
                  <td>
                    {p.degrees.d}°{p.degrees.m}'{p.degrees.s}"
                  </td>
                  <td>{p.house.id}</td>
                  <td>{p.starLoad.code}</td>
                  <td>{p.subLoad.code}</td>
                  <td>{p.subSubLoad.code}</td>
                  <td>{p.direct ? 'D' : 'R'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Cuspal Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>House</th>
                <th>Sign</th>
                <th>Degrees</th>
                <th>STL</th>
                <th>SL</th>
                <th>SSL</th>
              </tr>
            </thead>
            <tbody>
              {parsed.chartData.cuspalPositions.map((c: CuspalPosition) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.sign.name}</td>
                  <td>
                    {c.degrees.d}°{c.degrees.m}'{c.degrees.s}"
                  </td>
                  <td>{c.starLoad.code}</td>
                  <td>{c.subLoad.code}</td>
                  <td>{c.subSubLoad.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Dashas</CardTitle>
        </CardHeader>
        <CardContent>
          <DashaList periods={parsed.chartData.dashas} />
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name || !birthDate || !birthTimeOfDay || !timezone}
        >
          {saving ? 'Saving…' : 'Save horoscope'}
        </Button>
      </div>
    </div>
  );
};

export default ImportReviewPage;
