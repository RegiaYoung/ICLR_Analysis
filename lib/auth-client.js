import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' 
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.NODE_ENV === 'production' ? "https://openreview.online" : "http://localhost:3000"),
});

export const { useSession, signIn, signOut } = authClient;

export const signInWithGoogle = () => {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });
};

export const signInWithGitHub = () => {
  return authClient.signIn.social({
    provider: "github", 
    callbackURL: "/",
  });
};