import { createFileRoute } from "@tanstack/react-router";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { activateDeviceAccount } from "@/lib/device-activation.server";

export const Route = createFileRoute("/api/device/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        });

        if (!session) {
          return Response.json(
            {
              message: "認証セッションがありません。ログインし直してください。",
            },
            { status: 401 },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { message: "リクエストの形式が正しくありません。" },
            { status: 400 },
          );
        }

        const deviceCode =
          typeof body === "object" &&
          body !== null &&
          "deviceCode" in body &&
          typeof body.deviceCode === "string"
            ? body.deviceCode
            : null;

        if (deviceCode === null) {
          return Response.json(
            { message: "デバイスコードを指定してください。" },
            { status: 400 },
          );
        }

        try {
          await activateDeviceAccount(deviceCode, session.user.email);
        } catch (error) {
          if (!(error instanceof APIError)) throw error;

          return Response.json(
            { message: error.message },
            { status: error.statusCode },
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});
