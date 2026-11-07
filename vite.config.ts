import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative assets also work under github.io/app-futbol/.
  base: "./",
});
