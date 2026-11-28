import NextAuth, { AuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";

import { User } from "@/models/User";

import { resolveSsoUser } from "@/lib/authUser";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ account, user }) {
            if (!account) return false;
            return resolveSsoUser({
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                email: user.email,
                name: user.name,
            });
        },
        async session({ session }) {
            await connectDB();
            const user = await User.findOne({ email: session.user!.email });
            if (user) {
                session.user!.id = user.id;
                session.user!.role = user.role;
                logger.debug("session set for user: %s role=%s", user.email, user.role);
            }
            return session;
        },
    },
    pages: {
        signIn: "/signin",
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
