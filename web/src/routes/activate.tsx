import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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

function getErrorMessage(result: unknown) {
	return typeof result === "object" &&
		result !== null &&
		"message" in result &&
		typeof result.message === "string"
		? result.message
		: "アカウント連携に失敗しました。";
}

function RouteComponent() {
	const { deviceCode } = Route.useSearch();
	const [activation, setActivation] = useState<ActivationState>({
		status: "pending",
	});
	const activationRequest = useRef<{
		deviceCode: string;
		promise: Promise<ActivationState>;
	} | null>(null);

	useEffect(() => {
		let cancelled = false;

		if (!deviceCode) {
			setActivation({
				status: "error",
				message: "デバイスコードが見つかりません。",
			});
			return;
		}

		if (activationRequest.current?.deviceCode !== deviceCode) {
			const promise = (async (): Promise<ActivationState> => {
				try {
					const response = await fetch("/api/device/activate", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ deviceCode }),
					});
					const result: unknown = await response.json();

					if (!response.ok) {
						return { status: "error", message: getErrorMessage(result) };
					}

					return { status: "success" };
				} catch (error) {
					return {
						status: "error",
						message:
							error instanceof Error
								? error.message
								: "アカウント連携に失敗しました。",
					};
				}
			})();
			activationRequest.current = { deviceCode, promise };
		}

		const request = activationRequest.current;
		if (!request) return;

		void request.promise.then((result) => {
			if (!cancelled) setActivation(result);
		});

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
