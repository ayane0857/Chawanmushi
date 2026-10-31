import type { Route } from "./+types/home";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Sample() {
  async function handleSignIn() {
    const { error } = await authClient.signIn.social({
      provider: "oidc",
      callbackURL: "/",
    });

    if (error) {
      window.alert(error.message);
    }
  }
  return (
    <div>
      <p>sample</p>
      <button type="button" onClick={handleSignIn}>
        ログイン
      </button>
    </div>
  );
}
