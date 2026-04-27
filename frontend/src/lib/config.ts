const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000',
  nominatimUrl:
    process.env.NEXT_PUBLIC_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search',
  logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL ?? 'info',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

export default config;
