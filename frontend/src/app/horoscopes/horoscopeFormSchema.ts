import { z } from 'zod';

export const horoscopeFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  birthTimeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  timezone: z.string().min(1, 'Timezone is required'),
  location: z.object({
    latitude: z.number().refine((v) => v !== 0, 'Latitude is required'),
    longitude: z.number().refine((v) => v !== 0, 'Longitude is required'),
    label: z.string().min(1, 'Pick a location'),
  }),
});

export type HoroscopeFormValues = z.infer<typeof horoscopeFormSchema>;
