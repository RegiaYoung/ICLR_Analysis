import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { getPool } from "./db";

const env = (process.env.AUTH_ENV || "development").toLowerCase() === "production" ? "PROD" : "LOCAL";
const pick = (base) =>
  process.env[`${base}_${env}`] ||
  process.env[`${base}_${env.toUpperCase()}`] ||
  process.env[`${base}_PROD`] ||
  process.env[`${base}_LOCAL`];

// In production, always use the custom domain instead of Vercel's auto-generated URL
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (env === "PROD" ? "https://openreview.online" : 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));

export const auth = betterAuth({
  database: getPool(),
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: pick("GOOGLE_CLIENT_ID"),
      clientSecret: pick("GOOGLE_CLIENT_SECRET"),
      redirectURI: `${appUrl}/api/auth/callback/google`,
    },
    github: {
      clientId: pick("GITHUB_CLIENT_ID"),
      clientSecret: pick("GITHUB_CLIENT_SECRET"),
      redirectURI: `${appUrl}/api/auth/callback/github`,
    },
  },
});

export const authHandlers = toNextJsHandler(auth);
