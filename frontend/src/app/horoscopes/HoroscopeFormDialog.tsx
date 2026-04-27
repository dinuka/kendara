'use client';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import apiFetchClient from '@/lib/apiFetchClient';
import { geocode, GeocodeResult } from '@/lib/geocode';
import { horoscopeFormSchema, HoroscopeFormValues } from './horoscopeFormSchema';
import { Horoscope } from './types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useToast } from '@/components/ui/toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: Horoscope;
  onSaved: () => void;
};

const toDatePart = (iso: string) => {
  if (!iso) return '';
  return format(new Date(iso), 'yyyy-MM-dd');
};

const toTimePart = (iso: string) => {
  if (!iso) return '';
  return format(new Date(iso), 'HH:mm');
};

const timezones = Intl.supportedValuesOf('timeZone');

const HoroscopeFormDialog = ({ open, onOpenChange, mode, initial, onSaved }: Props) => {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HoroscopeFormValues>({
    resolver: zodResolver(horoscopeFormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          birthDate: toDatePart(initial.birthTime),
          birthTimeOfDay: toTimePart(initial.birthTime),
          timezone: initial.timezone,
          location: initial.location,
        }
      : {
          name: '',
          birthDate: '',
          birthTimeOfDay: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: { latitude: 0, longitude: 0, label: '' },
        },
  });

  const [timezoneQuery, setTimezoneQuery] = React.useState(
    initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const filteredTimezones = React.useMemo(
    () =>
      timezoneQuery.length === 0
        ? timezones
        : timezones.filter((tz) => tz.toLowerCase().includes(timezoneQuery.toLowerCase())),
    [timezoneQuery]
  );

  const [locationQuery, setLocationQuery] = React.useState(initial?.location.label ?? '');
  const [locationOptions, setLocationOptions] = React.useState<ComboboxOption[]>([]);
  const [geocoding, setGeocoding] = React.useState(false);
  const [latInput, setLatInput] = React.useState(initial?.location.latitude ? String(initial.location.latitude) : '');
  const [lonInput, setLonInput] = React.useState(initial?.location.longitude ? String(initial.location.longitude) : '');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? {
            name: initial.name,
            birthDate: toDatePart(initial.birthTime),
            birthTimeOfDay: toTimePart(initial.birthTime),
            timezone: initial.timezone,
            location: initial.location,
          }
        : { name: '', birthDate: '', birthTimeOfDay: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, location: { latitude: 0, longitude: 0, label: '' } }
    );
    setTimezoneQuery(initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setLocationQuery(initial?.location.label ?? '');
    setLocationOptions([]);
    setLatInput(initial?.location.latitude ? String(initial.location.latitude) : '');
    setLonInput(initial?.location.longitude ? String(initial.location.longitude) : '');
  }, [open, initial, reset]);

  const handleLocationInput = (value: string) => {
    setLocationQuery(value);
    setValue('location', { latitude: 0, longitude: 0, label: '' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      const results: GeocodeResult[] = await geocode(value);
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
    setValue('location', { latitude: lat, longitude: lon, label: option.label });
    setLocationQuery(option.label);
    setLatInput(String(lat));
    setLonInput(String(lon));
    setLocationOptions([]);
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLatInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) setValue('location', { ...getValues('location'), latitude: parsed });
  };

  const handleLonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLonInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) setValue('location', { ...getValues('location'), longitude: parsed });
  };

  const onSubmit = async (values: HoroscopeFormValues) => {
    const { birthDate, birthTimeOfDay, ...rest } = values;
    const body = {
      ...rest,
      birthTime: new Date(`${birthDate}T${birthTimeOfDay}:00`).toISOString(),
    };

    try {
      if (mode === 'create') {
        await apiFetchClient('/api/horoscopes', { method: 'POST', body: JSON.stringify(body) });
        toast('Horoscope created successfully');
      } else {
        await apiFetchClient(`/api/horoscopes/${initial!.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Horoscope updated successfully');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast(message, 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Horoscope' : 'Edit Horoscope'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. John Doe" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Birth date &amp; time</Label>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Controller
                  control={control}
                  name="birthDate"
                  render={({ field }) => (
                    <DateInput value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.birthDate && (
                  <p className="text-xs text-destructive">{errors.birthDate.message}</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Controller
                  control={control}
                  name="birthTimeOfDay"
                  render={({ field }) => (
                    <TimeInput value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.birthTimeOfDay && (
                  <p className="text-xs text-destructive">{errors.birthTimeOfDay.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Timezone</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Combobox
                  value={timezoneQuery}
                  options={filteredTimezones.map((tz) => ({ value: tz, label: tz }))}
                  onInputChange={(val) => {
                    setTimezoneQuery(val);
                    field.onChange('');
                  }}
                  onSelect={(option) => {
                    setTimezoneQuery(option.value);
                    field.onChange(option.value);
                  }}
                  placeholder="Search timezone…"
                />
              )}
            />
            {errors.timezone && (
              <p className="text-xs text-destructive">{errors.timezone.message}</p>
            )}
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
            {errors.location?.label && (
              <p className="text-xs text-destructive">{errors.location.label.message}</p>
            )}
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Input
                  placeholder="Latitude"
                  value={latInput}
                  onChange={handleLatChange}
                />
                {errors.location?.latitude && (
                  <p className="text-xs text-destructive">{errors.location.latitude.message}</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Input
                  placeholder="Longitude"
                  value={lonInput}
                  onChange={handleLonChange}
                />
                {errors.location?.longitude && (
                  <p className="text-xs text-destructive">{errors.location.longitude.message}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HoroscopeFormDialog;
