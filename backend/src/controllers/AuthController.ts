import { OAuth2Client } from 'google-auth-library';
import UserRepo from '../repos/UserRepo';
import config from '../config/config';
import { forbidden } from '../errors';
import SyncUserRequest from '../types/auth/SyncUserRequest';
import SyncUserResponse from '../types/auth/SyncUserResponse';

export default class AuthController {
  private readonly client = new OAuth2Client(config.googleClientId);

  constructor(private readonly userRepo: UserRepo) {}

  async syncUser({ body: { idToken } }: SyncUserRequest): Promise<SyncUserResponse> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: config.googleClientId });
    const payload = ticket.getPayload();

    if (!payload?.sub) {
      throw forbidden('Invalid Google token');
    }

    const { sub: googleId, email = '', name = '', picture: avatarUrl } = payload;
    const user = await this.userRepo.upsertByGoogleId(googleId, email, name, avatarUrl);

    return { status: 200, data: { user } };
  }
}
