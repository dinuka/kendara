import User from '../../models/User';
import ActionResponse from '../ActionResponse';

export type SyncUserData = { user: User };

type SyncUserResponse = ActionResponse<SyncUserData>;

export default SyncUserResponse;
