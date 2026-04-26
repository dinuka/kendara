import { Db } from 'mongodb';
import User, { Role } from '../models/User';

const COLLECTION = 'users';

export default class UserRepo {
  constructor(private readonly db: Db) { }

  async upsertByGoogleId(
    googleId: string,
    email: string,
    name: string,
    avatarUrl?: string,
  ): Promise<User> {
    const now = new Date();

    const result = await this.db.collection<User>(COLLECTION).findOneAndUpdate(
      { googleId },
      {
        $set: { email, name, avatarUrl, updatedAt: now },
        $setOnInsert: { id: crypto.randomUUID(), googleId, role: Role.User, createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result!;
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    return await this.db.collection<User>(COLLECTION).findOne({ googleId }) ?? undefined;
  }
}
