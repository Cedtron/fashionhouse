// Environment utilities
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Disable HMR WebSocket in production
if (isProduction && typeof window !== 'undefined') {
  // Override WebSocket to prevent HMR connections in production
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = class extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const urlString = url.toString();
      // Block Vite HMR WebSocket connections in production
      if (urlString.includes('/@vite/client') || urlString.includes('/vite-dev-server')) {
        console.warn('Blocked HMR WebSocket connection in production:', urlString);
        throw new Error('WebSocket connection blocked in production');
      }
      super(url, protocols);
    }
  };
}