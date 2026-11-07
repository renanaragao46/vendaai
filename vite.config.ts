// The Lovable wrapper supplies TanStack Start, React, Tailwind, aliases and Nitro.
// Use Nitro's Node server preset for a portable Render deployment.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
});
