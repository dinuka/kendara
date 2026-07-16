import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { User } from "@/models/User";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ profile }) {
            if (!profile?.email) return false;
            await connectDB();
            const existing = await User.findOne({ googleId: profile.sub });
            if (!existing) {
                logger.info("creating new user: email=%s", profile.email);
                await User.create({
                    googleId: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    role: "student",
                    preferredLanguage: "si",
                });
            } else {
                logger.debug("existing user signed in: email=%s", profile.email);
            }
            return true;
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
