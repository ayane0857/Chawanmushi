import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="flex h-screen justify-center items-center">
			<div className="flex flex-col border gap-4 p-8">
				<h1 className="text-2xl">UniQUE with Minecraft</h1>
				<div>
					<p>
						UniQUEユーザーのみがログインできるようにできるマイクラサービスです
					</p>
					<p>
						サーバー側のコードを少し変更することでUniQUE以外のシステムを使用することも可能です
					</p>
				</div>
				<Link className="border px-4 py-2" to="/device">
					デバイスコードを入力
				</Link>
			</div>
		</div>
	);
}
