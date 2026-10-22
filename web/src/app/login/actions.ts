"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkCredentials,
  createSessionToken,
  demoLoginConfigured,
} from "@/lib/demo-auth";

export type SignInState = { error: string | null };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!demoLoginConfigured()) {
    console.error("[login] DEMO_USERNAME or DEMO_PASSWORD is not set; sign-in is disabled");
    return { error: "Sign-in is not set up on this server." };
  }

  const username = formData.get("username");
  const password = formData.get("password");
  if (typeof username !== "string" || typeof password !== "string" || !checkCredentials(username.trim(), password)) {
    return { error: "Incorrect username or password." };
  }

  const token = createSessionToken();
  if (!token) return { error: "Sign-in is not set up on this server." };

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // HTTPS only when deployed; `next dev` serves plain http on localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
