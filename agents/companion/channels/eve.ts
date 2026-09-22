import { createClerkClient } from "@clerk/backend";
import { eveChannel } from "eve/channels/eve";
import { type AuthFn, withAuthChallenges } from "eve/channels/auth";

const clerk = createClerkClient({
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
});

const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
  ?.split(",")
  .map((party) => party.trim())
  .filter(Boolean);

const clerkSession: AuthFn<Request> = withAuthChallenges(
  async (request) => {
    const state = await clerk.authenticateRequest(request, {
      acceptsToken: "session_token",
      authorizedParties: authorizedParties?.length ? authorizedParties : undefined,
    });
    if (state.status !== "signed-in") return null;

    const auth = state.toAuth();
    if (!auth.userId) return null;

    return {
      attributes: {},
      authenticator: "clerk:session",
      issuer: "clerk",
      principalId: auth.userId,
      principalType: "user",
      subject: auth.userId,
    };
  },
  [{ scheme: "Bearer" }],
);

export default eveChannel({ auth: [clerkSession] });
