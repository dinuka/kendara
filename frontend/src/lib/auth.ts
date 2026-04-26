import NextAuth, { Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';

declare module 'next-auth' {
  interface Session {
    idToken?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ account }) {
      if (!account?.id_token) return false;

      try {
        const res = await fetch(`${process.env.BACKEND_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: account.id_token }),
        });

        return res.ok;
      } catch {
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.idToken = token.idToken as string | undefined;
      return session;
    },
  },
});
