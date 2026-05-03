import Link from 'next/link';
import apiFetch from '@/lib/apiFetch';
import { Horoscope } from '../types';
import { CollapsibleSection, PlanetaryTable, CuspalTable, DashaTree } from '../chartComponents';

type Props = {
  params: Promise<{ id: string }>;
};

const formatBirthTime = (birthTime: string, timezone: string) => {
  const date = new Date(birthTime);
  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${datePart} at ${timePart}`;
};

const HoroscopeDetailPage = async ({ params }: Props) => {
  const { id } = await params;
  const { horoscope } = await apiFetch<{ horoscope: Horoscope }>(`/api/horoscopes/${id}`);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href="/horoscopes"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to horoscopes
      </Link>

      <h1 className="mb-1 text-xl font-semibold">{horoscope.name}</h1>
      <p className="text-sm text-muted-foreground">
        {formatBirthTime(horoscope.birthTime, horoscope.timezone)} · {horoscope.timezone}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{horoscope.location.label}</p>

      {horoscope.chartData ? (
        <>
          <CollapsibleSection title="Planetary Positions">
            <PlanetaryTable positions={horoscope.chartData.planetaryPositions} />
          </CollapsibleSection>

          <CollapsibleSection title="Cuspal Positions">
            <CuspalTable positions={horoscope.chartData.cuspalPositions} />
          </CollapsibleSection>

          <CollapsibleSection title="Dashas" defaultOpen={false}>
            <DashaTree periods={horoscope.chartData.dashas} />
          </CollapsibleSection>
        </>
      ) : (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No chart data — re-import from a PDF to add it.
        </p>
      )}
    </div>
  );
};

export default HoroscopeDetailPage;
