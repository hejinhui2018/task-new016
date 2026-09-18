interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  showSafe: boolean;
  onToggleSafe: () => void;
  restored: boolean;
  onToggleGuide: () => void;
  guideOpen: boolean;
}

export function Toolbar({
  canUndo, canRedo, onUndo, onRedo, onReset,
  showSafe, onToggleSafe, restored, onToggleGuide, guideOpen,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">🍁</span>
        <div className="toolbar__title">
          <strong>CampaignFit</strong>
          <span className="toolbar__subtitle">多版位创意适配台 · 秋季发布会</span>
        </div>
        {restored && <span className="badge badge--saved" title="已从浏览器本地存储恢复">已恢复本地草稿</span>}
      </div>

      <div className="toolbar__actions">
        <button className="btn" onClick={onToggleGuide} aria-pressed={guideOpen}>
          {guideOpen ? '收起演示脚本' : '90 秒演示脚本'}
        </button>
        <button className={`btn ${showSafe ? 'btn--active' : ''}`} onClick={onToggleSafe}>
          安全区
        </button>
        <span className="toolbar__sep" />
        <button className="btn btn--icon" onClick={onUndo} disabled={!canUndo} title="撤销 (Ctrl/⌘+Z)">
          ↶ 撤销
        </button>
        <button className="btn btn--icon" onClick={onRedo} disabled={!canRedo} title="重做 (Ctrl/⌘+Shift+Z)">
          ↷ 重做
        </button>
        <button className="btn btn--danger" onClick={onReset} title="清空全部修改与覆盖，回到内置素材">
          一键重置
        </button>
      </div>
    </header>
  );
}
