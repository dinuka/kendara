export const config = {
  port: process.env.PORT ?? '4000',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME ?? 'kendara',
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
};
