import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import { prisma } from "./src/lib/prisma";

const oidcName = process.env.OIDC_NAME;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const oidcUrl = process.env.OIDC_URL;
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!clientId || !clientSecret || !oidcUrl || !secret || !baseURL) {
  throw new Error("Missing Better Auth or OIDC environment variables");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret,
  baseURL,
  trustedOrigins: [baseURL],
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          clientId,
          clientSecret,
          discoveryUrl: `https://${oidcUrl}/.well-known/openid-configuration`,
        },
        // Add more providers as needed
      ],
    }),
  ],
});
