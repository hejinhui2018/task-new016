/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认 node 环境（纯逻辑测试启动快）；需要 DOM 的文件用
    // `// @vitest-environment jsdom` 文件头单独声明
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
