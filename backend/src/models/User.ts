export enum Role {
  User = 'user',
  Admin = 'admin',
}

type User = {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

export default User;
