import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact(), nitro()],
  server: {
    proxy: {
      "/mojang-api": {
        target: "https://api.mojang.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mojang-api/, ""),
      },
    },
  },
});

export default config;
