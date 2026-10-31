import { randomInt } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { temp, user } from "@/db/schema";

const CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;
const MAX_CODE_GENERATION_ATTEMPTS = 10;
const UUID_PATTERN =
	/^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

function generateDeviceCode() {
	return Array.from({ length: CODE_LENGTH }, () =>
		CODE_CHARACTERS.charAt(randomInt(CODE_CHARACTERS.length)),
	).join("");
}

export const Route = createFileRoute("/api/device/resolve")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const uuid = url.searchParams.get("uuid");

				if (!uuid) {
					return Response.json(
						{ ok: false, error: "uuid is required" },
						{ status: 400 },
					);
				}
				if (!UUID_PATTERN.test(uuid)) {
					return Response.json(
						{ ok: false, error: "uuid is invalid" },
						{ status: 400 },
					);
				}
				const result = await db
					.select()
					.from(user)
					.where(eq(user.minecraftuuid, uuid));
				if (result.length === 1) {
					return Response.json({ Registration: true });
				}

				const now = new Date();
				const [pendingCode] = await db
					.select({ code: temp.code })
					.from(temp)
					.where(and(eq(temp.minecraftuuid, uuid), gt(temp.expiresAt, now)))
					.limit(1);
				if (pendingCode) {
					return Response.json({
						Registration: false,
						code: pendingCode.code,
					});
				}

				for (
					let attempt = 0;
					attempt < MAX_CODE_GENERATION_ATTEMPTS;
					attempt++
				) {
					const code = generateDeviceCode();
					const [createdCode] = await db
						.insert(temp)
						.values({
							minecraftuuid: uuid,
							code,
							expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
						})
						.onConflictDoNothing()
						.returning({ code: temp.code });

					if (createdCode) {
						return Response.json({
							Registration: false,
							code: createdCode.code,
						});
					}
				}

				return Response.json(
					{
						ok: false,
						error: "Could not generate a unique device code. Please try again.",
					},
					{ status: 503 },
				);
			},
		},
	},
});
