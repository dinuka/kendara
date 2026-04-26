import RequestType from '../RequestType';

export type SyncUserBody = { idToken: string };

type SyncUserRequest = RequestType<SyncUserBody>;

export default SyncUserRequest;
