'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashaPeriod, PlanetaryPosition, CuspalPosition } from './types';

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

export { CollapsibleSection, PlanetaryTable, CuspalTable, DashaTree };
