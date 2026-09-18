import { describe, expect, it } from 'vitest';
import { measureText, wrapText } from './textMeasure';

describe('确定性文本测量与折行', () => {
  it('全角 CJK 字宽 = 字号，西文按比例近似', () => {
    expect(measureText('秋季', 64)).toBeCloseTo(128, 6);
    expect(measureText('AB', 100)).toBeCloseTo(112, 6);
    expect(measureText('', 16)).toBe(0);
  });

  it('CJK 按字符折行，每行不超最大宽度', () => {
    const lines = wrapText('秋季发布会正式登场', 64, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 64)).toBeLessThanOrEqual(200 + 1e-6);
    }
    expect(lines.join('').replace(/\s/g, '')).toBe('秋季发布会正式登场');
  });

  it('西文词整体换行，不被拦腰折断', () => {
    const lines = wrapText('autumn launch event tonight', 20, 100);
    for (const line of lines) {
      expect(measureText(line, 20)).toBeLessThanOrEqual(100 + 1e-6);
    }
    // 所有词都应完整出现在结果中
    const joined = lines.join(' ');
    for (const w of ['autumn', 'launch', 'event', 'tonight']) {
      expect(joined).toContain(w);
    }
  });

  it('超长单个西文词强制折断而非无限溢出', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious', 16, 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 16)).toBeLessThanOrEqual(60 + 1e-6);
    }
  });

  it('尊重显式换行；空文本返回空数组', () => {
    expect(wrapText('第一行\n第二行', 64, 1000)).toEqual(['第一行', '第二行']);
    expect(wrapText('', 64, 100)).toEqual([]);
  });
});
