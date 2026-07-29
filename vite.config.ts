/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // keep Claude Code worktrees (stale PR checkouts) out of the test sweep
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
})
