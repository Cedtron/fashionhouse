import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { disableHMRInProduction } from "./vite-plugins/disable-hmr-prod";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    base: '/',
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          // This will transform your SVG to a React component
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
      ...(isProduction ? [disableHMRInProduction()] : []),
    ],
    server: {
      hmr: !isProduction ? {
        port: 24678, // Use a specific port for HMR in development
      } : false, // Disable HMR in production
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
      // Ensure clean builds
      emptyOutDir: true,
    },
    // Disable HMR client injection in production
    define: {
      __VITE_HMR__: !isProduction,
      'import.meta.hot': isProduction ? 'undefined' : 'import.meta.hot',
    },
  };
});
