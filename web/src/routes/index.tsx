import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { data: session, isPending } = authClient.useSession();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	async function handleSignIn() {
		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			const { error } = await authClient.signIn.social({
				provider: "oidc",
				callbackURL: "/",
			});

			if (error) {
				setErrorMessage(error.message ?? "Sign in failed.");
			}
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Sign in failed.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleSignOut() {
		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			const { error } = await authClient.signOut();

			if (error) {
				setErrorMessage(error.message ?? "Sign out failed.");
			}
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Sign out failed.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">Welcome</h1>
			{isPending ? (
				<p className="mt-4">Checking sign-in status...</p>
			) : session?.user ? (
				<div className="mt-4">
					<p>Signed in as {session.user.name || session.user.email}.</p>
					<button
						className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
						disabled={isSubmitting}
						onClick={handleSignOut}
						type="button"
					>
						{isSubmitting ? "Signing out..." : "Sign out"}
					</button>
				</div>
			) : (
				<button
					className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
					disabled={isSubmitting}
					onClick={handleSignIn}
					type="button"
				>
					{isSubmitting ? "Signing in..." : "Sign in"}
				</button>
			)}
			{errorMessage && (
				<p className="mt-4 text-red-600" role="alert">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
