import type { CoverResult, Rect } from '../types';
import { clamp } from './geometry';

/**
 * 图片以 cover 方式铺满画布，并尽量把归一化焦点 (focusX, focusY) 放在
 * 画布上对应比例的位置。
 *
 * 规则：
 * 1. scale = max(canvasW/imgW, canvasH/imgH)，图片始终铺满、不拉伸；
 * 2. 先让「源图焦点 → 画布焦点（同比例点）」对齐；
 * 3. 图片不能离开画布（否则露出空白），因此对齐位置再被夹回合法范围；
 *    被夹回说明焦点无法精确对齐（focusClamped），但焦点仍在画面内；
 * 4. 输出各边源图裁切比例，供 UI 显示裁切线；并判断焦点是否被裁掉。
 */
export function coverWithFocus(
  canvasWidth: number,
  canvasHeight: number,
  imgWidth: number,
  imgHeight: number,
  focusX: number,
  focusY: number,
): CoverResult {
  const fx = clamp(focusX, 0, 1);
  const fy = clamp(focusY, 0, 1);

  const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;

  // 期望：焦点落在画布同比例点上
  const desiredX = canvasWidth * fx - drawW * fx;
  const desiredY = canvasHeight * fy - drawH * fy;

  // 图片必须完全覆盖画布：允许的左上角范围
  const minX = canvasWidth - drawW; // <= 0
  const maxX = 0;
  const minY = canvasHeight - drawH;
  const maxY = 0;

  const x = clamp(desiredX, minX, maxX);
  const y = clamp(desiredY, minY, maxY);

  const focusScreen = {
    x: x + drawW * fx,
    y: y + drawH * fy,
  };
  const focusClamped = x !== desiredX || y !== desiredY;
  // 焦点落在画布外（理论上铺满+夹取后不会，防御性判断）
  const focusCropped =
    focusScreen.x < 0 ||
    focusScreen.x > canvasWidth ||
    focusScreen.y < 0 ||
    focusScreen.y > canvasHeight;

  // 源图被裁掉的比例
  const cropLeft = -x / drawW;
  const cropTop = -y / drawH;
  const cropRight = (drawW + x - canvasWidth) / drawW;
  const cropBottom = (drawH + y - canvasHeight) / drawH;

  const rect: Rect = { x, y, width: drawW, height: drawH };

  return {
    rect,
    scale,
    crop: {
      left: clamp(cropLeft, 0, 1),
      right: clamp(cropRight, 0, 1),
      top: clamp(cropTop, 0, 1),
      bottom: clamp(cropBottom, 0, 1),
    },
    focusScreen,
    focusClamped,
    focusCropped,
  };
}
