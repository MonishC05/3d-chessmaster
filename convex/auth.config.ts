import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://boss-whale-2451.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
