interface GuideProps {
  open: boolean;
  onClose: () => void;
}

const STEPS: { t: string; title: string; body: string }[] = [
  {
    t: '0–20s',
    title: '改长标题，三版位同步',
    body: '选中主创意里的「标题」，把文案改为「秋季发布会 · 新一代极光系列正式登场，预约直播享限定好礼」。官网横幅仍放得下，移动开屏立即标红——无需逐版位挪元素。',
  },
  {
    t: '20–45s',
    title: '读懂移动版冲突',
    body: '点开「移动开屏」卡片，红色描边与冲突条会指出：标题折成 6 行后顶到贴底免责声明，互相侵入约 90px。引擎没有偷偷缩小字号或让元素重叠。',
  },
  {
    t: '45–60s',
    title: '调整背景焦点',
    body: '拖动画板中的十字准星（或在右侧改 fx/fy），三个版位的 cover 裁切同时保住落日；焦点被素材边缘夹住时会自动夹回。',
  },
  {
    t: '60–80s',
    title: '为移动版加覆盖',
    body: '在移动版选中标题，把字号与最小字号都改为 34px（行宽 320px 不变）——字段变为紫色实线并出现「覆」角标，其他版位不受影响，标题折成 4 行后冲突解除。只改字号不动最小字号会触发最小字号冲突，约束系统不允许偷偷破线。',
  },
  {
    t: '80–90s',
    title: '恢复继承',
    body: '点字段旁的 ↺ 或卡片上的「全部恢复继承」，移动版立刻回到主创意规格（冲突重现）。再用 Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z 重做；刷新页面草稿仍在，「一键重置」回到初始素材。',
  },
];

export function DemoGuide({ open, onClose }: GuideProps) {
  if (!open) return null;
  return (
    <aside className="guide" aria-label="90 秒演示脚本">
      <div className="guide__head">
        <strong>90 秒演示脚本</strong>
        <button className="btn btn--mini" onClick={onClose}>收起 ✕</button>
      </div>
      <ol className="guide__steps">
        {STEPS.map((s) => (
          <li key={s.t}>
            <span className="guide__time">{s.t}</span>
            <div>
              <div className="guide__title">{s.title}</div>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
