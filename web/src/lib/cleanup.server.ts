import { db } from "../db";
import { temp } from "../db/schema";
import { lt } from "drizzle-orm";

const state = globalThis as typeof globalThis & {
  __cleanupRunning?: boolean;
};

export async function cleanupExpiredCodes() {
  if (state.__cleanupRunning) return;

  state.__cleanupRunning = true;

  try {
    const now = new Date();

    const deleted = await db
      .delete(temp)
      .where(lt(temp.expiresAt, now))
      .returning({ id: temp.id });

    if (deleted.length > 0) {
      console.log(`[Cleanup] ${deleted.length}件削除しました`);
    }
  } catch (error) {
    console.error("[Cleanup] エラー:", error);
  } finally {
    state.__cleanupRunning = false;
  }
}
