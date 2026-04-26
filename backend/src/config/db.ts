import { MongoClient, Db } from 'mongodb';

let client: MongoClient;

export const connectClient = async (uri: string, dbName: string): Promise<Db> => {
  client = new MongoClient(uri);
  await client.connect();
  return client.db(dbName);
};

export const getDb = (): Db => {
  if (!client) throw new Error('MongoDB client not initialized — call connectClient first');
  return client.db();
};
