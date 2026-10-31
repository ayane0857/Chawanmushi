import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { cleanupExpiredCodes } from "./lib/cleanup.server";

const globalState = globalThis as typeof globalThis & {
  __tempCleanupTimer?: ReturnType<typeof setInterval>;
};

// Schedulerの二重起動を防止
if (!globalState.__tempCleanupTimer) {
  console.log("[Cleanup] Scheduler started");

  // 起動時に一度実行
  void cleanupExpiredCodes();

  // 1分ごとに実行
  globalState.__tempCleanupTimer = setInterval(() => {
    void cleanupExpiredCodes();
  }, 60_000);
}

export default createServerEntry({
  fetch(request, opts) {
    return handler.fetch(request, opts);
  },
});
