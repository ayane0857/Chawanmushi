import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold">MinecraftにOIDCログインを</h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
        MinecraftでOIDC（OpenID
        Connect）認証を利用したログインを実現するプロジェクトです。
        詳細はGitHubをご覧ください。
      </p>

      <a
        href="https://github.com/ayane0857/Chawanmushi"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 text-sm font-semibold text-emerald-700 underline hover:text-emerald-900"
      >
        GitHub →
      </a>

      <footer className="absolute flex flex-row gap-6 bottom-6 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Chawanmushi Project</span>
        <a
          href="https://github.com/ayane0857/Chawanmushi"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-700"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
