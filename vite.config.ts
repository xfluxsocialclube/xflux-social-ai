import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' facilita o empacotamento futuro com Tauri 2.
export default defineConfig({ plugins: [react()], base: './', server: { port: 5173 } });
