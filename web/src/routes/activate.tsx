import { createFileRoute, Link } from "@tanstack/react-router";
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
		<div className="flex h-screen justify-center items-center">
			<div className="flex flex-col border gap-4 p-8">
				{activation.status === "pending" ? (
					<h1 className="text-2xl">アカウントを連携しています...</h1>
				) : activation.status === "success" ? (
					<>
						<h1 className="text-2xl">連携が完了しました</h1>
						<div>
							<p>Minecraftアカウントとの連携が完了しました。</p>
							<p>このページ（ブラウザ）は閉じていただいて問題ありません。</p>
							<p>ゲーム画面に戻ってご確認ください。</p>
						</div>
					</>
				) : (
					<>
						<h1 className="text-2xl">エラーが発生しました</h1>
						<p role="alert">{activation.message}</p>
						<Link className="border px-4 py-2" to="/device">
							もう一度、デバイスコードを入力する
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
