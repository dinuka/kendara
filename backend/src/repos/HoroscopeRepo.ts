import { Db } from 'mongodb';
import Horoscope from '../models/Horoscope';
import StoredChartData from '../models/ChartDataStored';

const COLLECTION = 'horoscopes';

export default class HoroscopeRepo {
  constructor(private readonly db: Db) {}

  async create(
    ownerId: string,
    name: string,
    birthTime: Date,
    timezone: string,
    latitude: number,
    longitude: number,
    locationLabel: string,
    chartData?: StoredChartData
  ): Promise<Horoscope> {
    const now = new Date();
    const horoscope: Horoscope = {
      id: crypto.randomUUID(),
      owner: { id: ownerId },
      name,
      birthTime,
      timezone,
      location: { latitude, longitude, label: locationLabel },
      ...(chartData ? { chartData } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection<Horoscope>(COLLECTION).insertOne(horoscope);
    return horoscope;
  }

  async listByOwner(ownerId: string): Promise<Horoscope[]> {
    return this.db
      .collection<Horoscope>(COLLECTION)
      .find({ 'owner.id': ownerId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Horoscope | undefined> {
    return (
      (await this.db
        .collection<Horoscope>(COLLECTION)
        .findOne({ id, 'owner.id': ownerId }, { projection: { _id: 0 } })) ?? undefined
    );
  }

  async update(
    id: string,
    ownerId: string,
    name: string,
    birthTime: Date,
    timezone: string,
    latitude: number,
    longitude: number,
    locationLabel: string,
    chartData?: StoredChartData
  ): Promise<Horoscope | undefined> {
    const $set: Record<string, unknown> = {
      name,
      birthTime,
      timezone,
      location: { latitude, longitude, label: locationLabel },
      updatedAt: new Date(),
    };
    if (chartData) $set.chartData = chartData;
    const result = await this.db
      .collection<Horoscope>(COLLECTION)
      .findOneAndUpdate(
        { id, 'owner.id': ownerId },
        { $set },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
    return result ?? undefined;
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .collection<Horoscope>(COLLECTION)
      .deleteOne({ id, 'owner.id': ownerId });
    return result.deletedCount === 1;
  }
}
