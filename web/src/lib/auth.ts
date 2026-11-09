import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const authUrl = process.env.AUTH_URL;
const baseUrl = process.env.BETTER_AUTH_URL;

if (!clientId || !clientSecret || !authUrl || !baseUrl) {
  throw new Error("CLIENT_ID, CLIENT_SECRET, AUTH_URL must be set");
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [baseUrl],
  plugins: [
    tanstackStartCookies(),
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          clientId,
          clientSecret,
          discoveryUrl: `https://${authUrl}/.well-known/openid-configuration`,
          scopes: ["email", "profile"],
        },
      ],
    }),
  ],
});
