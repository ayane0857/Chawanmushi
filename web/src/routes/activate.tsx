import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/activate")({
	validateSearch: (search: Record<string, unknown>) => ({
		deviceCode: typeof search.deviceCode === "string" ? search.deviceCode : "",
	}),
	component: RouteComponent,
});

type ActivationState =
	| { status: "pending" }
	| { status: "success" }
	| { status: "error"; message: string };

function RouteComponent() {
	const { deviceCode } = Route.useSearch();
	const [activation, setActivation] = useState<ActivationState>({
		status: "pending",
	});

	useEffect(() => {
		let cancelled = false;

		async function activate() {
			if (!deviceCode) {
				setActivation({
					status: "error",
					message: "デバイスコードが見つかりません。",
				});
				return;
			}

			try {
				const response = await fetch("/api/device/activate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ deviceCode }),
				});
				const result: unknown = await response.json();

				if (!response.ok) {
					const message =
						typeof result === "object" &&
						result !== null &&
						"message" in result &&
						typeof result.message === "string"
							? result.message
							: "アカウント連携に失敗しました。";
					throw new Error(message);
				}

				if (!cancelled) setActivation({ status: "success" });
			} catch (error) {
				if (!cancelled) {
					setActivation({
						status: "error",
						message:
							error instanceof Error
								? error.message
								: "アカウント連携に失敗しました。",
					});
				}
			}
		}

		void activate();

		return () => {
			cancelled = true;
		};
	}, [deviceCode]);

	return (
		<main className="flex h-screen items-center justify-center">
			{activation.status === "pending" ? (
				<p>アカウントを連携しています...</p>
			) : activation.status === "success" ? (
				<p>アカウント連携が完了しました。</p>
			) : (
				<p role="alert">{activation.message}</p>
			)}
		</main>
	);
}
