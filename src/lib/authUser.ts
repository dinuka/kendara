import { User } from "@/models/User";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

/** SSO providers Kendara accepts, mapped to the User field holding that provider's account id. */
export const PROVIDER_ID_FIELDS = {
    google: "googleId",
    facebook: "facebookId",
} as const;

export type SsoProvider = keyof typeof PROVIDER_ID_FIELDS;

export interface SsoSignIn {
    provider: string;
    providerAccountId: string;
    email?: string | null;
    name?: string | null;
}

/**
 * Resolves the Kendara user for an SSO sign-in. Lookup order:
 *  1. by the provider's account id (returning user),
 *  2. by email — links the new provider onto an existing account (e.g. a Google user signing in
 *     with Facebook under the same email),
 *  3. otherwise creates a new `student` user.
 * Returns false (sign-in rejected) for unknown providers or when the provider returns no email,
 * since sessions are resolved by email.
 */
export async function resolveSsoUser({ provider, providerAccountId, email, name }: SsoSignIn): Promise<boolean> {
    if (!(provider in PROVIDER_ID_FIELDS)) {
        logger.warn("sign-in rejected: unsupported provider=%s", provider);
        return false;
    }
    if (!email) {
        logger.warn("sign-in rejected: provider=%s returned no email", provider);
        return false;
    }
    const idField = PROVIDER_ID_FIELDS[provider as SsoProvider];

    await connectDB();
    const byProviderId = await User.findOne({ [idField]: providerAccountId });
    if (byProviderId) {
        logger.debug("existing user signed in: email=%s provider=%s", email, provider);
        return true;
    }

    const byEmail = await User.findOne({ email });
    if (byEmail) {
        logger.info("linking provider=%s to existing user: email=%s", provider, email);
        await User.updateOne({ _id: byEmail._id }, { $set: { [idField]: providerAccountId } });
        return true;
    }

    logger.info("creating new user: email=%s provider=%s", email, provider);
    await User.create({
        [idField]: providerAccountId,
        email,
        name: name || email,
        role: "student",
        preferredLanguage: "si",
    });
    return true;
}
