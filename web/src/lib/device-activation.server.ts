import { APIError } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { temp, user } from "@/db/schema";

export async function activateDeviceAccount(deviceCode: string, email: string) {
	if (!/^[A-Za-z0-9]{6}$/.test(deviceCode)) {
		throw new APIError("BAD_REQUEST", {
			code: "INVALID_DEVICE_CODE",
			message: "デバイスコードが無効です。",
		});
	}

	await db.transaction(async (tx) => {
		const pendingActivations = await tx
			.select({
				id: temp.id,
				minecraftuuid: temp.minecraftuuid,
			})
			.from(temp)
			.where(and(eq(temp.code, deviceCode), gt(temp.expiresAt, new Date())))
			.limit(2)
			.for("update");

		if (pendingActivations.length === 0) {
			throw new APIError("BAD_REQUEST", {
				code: "INVALID_OR_EXPIRED_DEVICE_CODE",
				message: "デバイスコードが無効か、有効期限が切れています。",
			});
		}

		if (pendingActivations.length > 1) {
			throw new APIError("CONFLICT", {
				code: "AMBIGUOUS_DEVICE_CODE",
				message:
					"デバイスコードが重複しています。新しいコードを発行してください。",
			});
		}

		const pendingActivation = pendingActivations[0];
		if (!pendingActivation) {
			throw new Error("A pending activation was expected.");
		}

		const [createdUser] = await tx
			.insert(user)
			.values({
				minecraftuuid: pendingActivation.minecraftuuid,
				email,
			})
			.onConflictDoNothing()
			.returning({ id: user.id });

		if (!createdUser) {
			throw new APIError("CONFLICT", {
				code: "ACCOUNT_ALREADY_LINKED",
				message:
					"このアカウントまたは Minecraft アカウントは既に連携されています。",
			});
		}

		await tx.delete(temp).where(eq(temp.id, pendingActivation.id));
	});
}
