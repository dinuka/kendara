import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: "student" | "super-admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
