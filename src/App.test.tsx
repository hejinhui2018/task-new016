// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

beforeEach(() => localStorage.clear());

describe('App 端到端渲染（初始素材）', () => {
  it('三个版位 + 主创意画布均渲染，初始无冲突文案', () => {
    const html = renderToString(<App />);
    expect(html).toContain('官网横幅');
    expect(html).toContain('移动开屏');
    expect(html).toContain('社媒方图');
    expect(html).toContain('主创意画布');
    expect(html).toContain('秋季发布会');
    expect(html).toContain('三个版位均满足约束');
    // 初始没有任何人工覆盖角标 / 冲突徽标
    expect(html).not.toContain('项冲突');
  });
});
