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
const TODAY = '2026-05-03';

const isDateInRange = (date: string, start: string, end: string) => date >= start && date <= end;

const findActivePath = (periods: DashaPeriod[], today: string): Set<string> => {
  const active = new Set<string>();
  const walk = (list: DashaPeriod[], parentKey: string): boolean => {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const key = `${parentKey}-${p.lord.code}-${i}`;
      if (isDateInRange(today, p.startDate, p.endDate)) {
        active.add(key);
        if (p.subDashaPeriods.length) walk(p.subDashaPeriods, key);
        return true;
      }
    }
    return false;
  };
  walk(periods, 'root');
  return active;
};

type DashaNodeProps = {
  period: DashaPeriod;
  nodeKey: string;
  activePath: Set<string>;
  depth: number;
};

const DashaNode = ({ period, nodeKey, activePath, depth }: DashaNodeProps) => {
  const isActive = activePath.has(nodeKey);
  const [open, setOpen] = React.useState(isActive);
  const hasSub = period.subDashaPeriods.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}`}>
      <div
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
          isActive ? 'bg-primary/8 font-medium text-primary' : 'text-foreground'
        } ${hasSub ? 'cursor-pointer hover:bg-muted' : ''}`}
        onClick={() => hasSub && setOpen((o) => !o)}
      >
        {hasSub && <span className="text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>}
        {!hasSub && <span className="w-3" />}
        <span
          className={`w-6 font-mono text-xs font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
        >
          {period.lord.code}
        </span>
        <span className="flex-1 text-xs text-muted-foreground">
          {period.startDate} → {period.endDate}
        </span>
        {isActive && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Now
          </span>
        )}
      </div>
      {open && hasSub && (
        <div className="mt-0.5">
          {period.subDashaPeriods.map((sub, i) => (
            <DashaNode
              key={`${nodeKey}-${sub.lord.code}-${i}`}
              period={sub}
              nodeKey={`${nodeKey}-${sub.lord.code}-${i}`}
              activePath={activePath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const CollapsibleSection = ({ title, defaultOpen = true, children }: CollapsibleSectionProps) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Card className="mt-4 overflow-hidden">
      <CardHeader className="cursor-pointer px-5 py-4" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
        </div>
      </CardHeader>
      {open && <CardContent className="px-5 pb-5 pt-0">{children}</CardContent>}
    </Card>
  );
};

type ThProps = React.ThHTMLAttributes<HTMLTableCellElement> & { title?: string };

const Th = ({ children, title, className = '', ...props }: ThProps) => (
  <th
    title={title}
    className={`bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground ${className}`}
    {...props}
  >
    {children}
  </th>
);

const Td = ({
  children,
  className = '',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`px-3 py-2 text-xs ${className}`} {...props}>
    {children}
  </td>
);

const DegreesCell = ({ d, m, s }: { d: number; m: number; s: number }) => (
  <span className="font-mono text-xs">
    {d}°{m}'{s}"
  </span>
);

const PlanetBadge = ({ code, direct }: { code: string; direct?: boolean }) => (
  <span className="inline-flex items-center gap-1">
    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground">
      {code}
    </span>
    {direct !== undefined && (
      <span
        className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
          direct ? 'bg-secondary text-muted-foreground' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {direct ? 'D' : 'R'}
      </span>
    )}
  </span>
);

const PlanetaryTable = ({ positions }: { positions: PlanetaryPosition[] }) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th>Planet</Th>
          <Th>Sign</Th>
          <Th className="text-right" title="Degree, minute, second">
            Degrees
          </Th>
          <Th className="text-right" title="House number">
            House
          </Th>
          <Th title="Star Lord">Star Ld.</Th>
          <Th title="Sub Lord">Sub Ld.</Th>
          <Th title="Sub-Sub Lord">SSL</Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <tr key={p.planet.id} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
            <Td>
              <PlanetBadge code={p.planet.code} direct={p.direct} />
            </Td>
            <Td>{p.sign.name}</Td>
            <Td className="text-right">
              <DegreesCell {...p.degrees} />
            </Td>
            <Td className="text-right font-mono">{p.house.id}</Td>
            <Td className="font-mono text-muted-foreground">{p.starLoad.code}</Td>
            <Td className="font-mono text-muted-foreground">{p.subLoad.code}</Td>
            <Td className="font-mono text-muted-foreground">{p.subSubLoad.code}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CuspalTable = ({ positions }: { positions: CuspalPosition[] }) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th title="House number">House</Th>
          <Th>Sign</Th>
          <Th className="text-right" title="Degree, minute, second">
            Degrees
          </Th>
          <Th title="Star Lord">Star Ld.</Th>
          <Th title="Sub Lord">Sub Ld.</Th>
          <Th title="Sub-Sub Lord">SSL</Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((c, i) => (
          <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
            <Td className="font-mono font-medium">{c.id}</Td>
            <Td>{c.sign.name}</Td>
            <Td className="text-right">
              <DegreesCell {...c.degrees} />
            </Td>
            <Td className="font-mono text-muted-foreground">{c.starLoad.code}</Td>
            <Td className="font-mono text-muted-foreground">{c.subLoad.code}</Td>
            <Td className="font-mono text-muted-foreground">{c.subSubLoad.code}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DashaTree = ({ periods }: { periods: DashaPeriod[] }) => {
  const activePath = React.useMemo(() => findActivePath(periods, TODAY), [periods]);

  return (
    <div className="space-y-0.5">
      {periods.map((p, i) => (
        <DashaNode
          key={`root-${p.lord.code}-${i}`}
          period={p}
          nodeKey={`root-${p.lord.code}-${i}`}
          activePath={activePath}
          depth={0}
        />
      ))}
    </div>
  );
};

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
      <h1 className="mb-1 text-xl font-semibold">Review imported horoscope</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        OCR may have errors — edit the basic fields before saving. Chart data is read-only this
        iteration.
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

      <CollapsibleSection title="Planetary Positions">
        <PlanetaryTable positions={parsed.chartData.planetaryPositions} />
      </CollapsibleSection>

      <CollapsibleSection title="Cuspal Positions">
        <CuspalTable positions={parsed.chartData.cuspalPositions} />
      </CollapsibleSection>

      <CollapsibleSection title="Dashas" defaultOpen={false}>
        <DashaTree periods={parsed.chartData.dashas} />
      </CollapsibleSection>

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
