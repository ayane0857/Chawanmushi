import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/device/resolve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const uuid = url.searchParams.get("uuid");

        console.log(uuid);

        if (!uuid) {
          return Response.json(
            { ok: false, error: "uuid is required" },
            { status: 400 },
          );
        }

        return Response.json({ ok: true, uuid });
      },
    },
  },
});
