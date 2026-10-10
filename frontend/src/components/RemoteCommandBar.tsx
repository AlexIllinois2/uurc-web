import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  GripHorizontal,
  LoaderCircle,
  Maximize2,
  MousePointerClick,
  PlugZap,
  RotateCcw,
  Scan,
} from "lucide-react";

import type { RemoteControlPageProps } from "../app/remoteControlPageProps.js";
import { RemoteShortcutMenu } from "./RemoteShortcutMenu.js";
import { useDraggableFloatingPanel } from "./useDraggableFloatingPanel.js";

export function RemoteCommandBar({
  busy,
  canReconnectRemote,
  controlChannelState,
  inputControlActive,
  isFullscreen,
  nextAction,
  onNextAction,
  onReconnectRemote,
  onRemoteShortcut,
  onStageViewModeChange,
  onToggleInputControl,
  onToggleFullscreen,
  remoteRecoveryLabel,
  remoteShortcutPlatform,
  remoteStageViewMode,
}: Pick<
  RemoteControlPageProps,
  | "busy"
  | "canReconnectRemote"
  | "controlChannelState"
  | "inputControlActive"
  | "isFullscreen"
  | "nextAction"
  | "onNextAction"
  | "onReconnectRemote"
  | "onRemoteShortcut"
  | "onStageViewModeChange"
  | "onToggleInputControl"
  | "onToggleFullscreen"
  | "remoteRecoveryLabel"
  | "remoteShortcutPlatform"
  | "remoteStageViewMode"
>) {
  const nextStageMode = remoteStageViewMode === "fit" ? "fill" : "fit";
  // 非全屏时工具栏固定在画面上方原位（不可拖动）；仅全屏时允许悬浮拖到画面内任意位置。
  const { dragHandleProps, panelRef, panelStyle, dockedEdge, dockTabStyle, restoreFromEdge } =
    useDraggableFloatingPanel<HTMLElement>(isFullscreen);
  const connected = controlChannelState === "open";
  // 半圆恢复按钮的箭头指向工具栏恢复后展开的方向。
  const DockTabIcon =
    dockedEdge === "left" ? ChevronRight : dockedEdge === "right" ? ChevronLeft : dockedEdge === "top" ? ChevronDown : ChevronUp;

  return (
    <>
      <section ref={panelRef} className="control-command-bar" style={panelStyle} aria-label="远控主流程">
        {isFullscreen ? (
          <button className="command-drag-handle" type="button" aria-label="拖动工具栏" {...dragHandleProps}>
            <GripHorizontal size={17} />
          </button>
        ) : null}
        {remoteRecoveryLabel ? (
          <div className="connection-recovery-strip" role="status">
            <AlertTriangle size={16} />
            <span>{remoteRecoveryLabel}</span>
            <button onClick={onReconnectRemote} disabled={!canReconnectRemote || busy !== null}>
              <RotateCcw size={16} />
              立即重连
            </button>
          </div>
        ) : null}
        <div className="command-action-group command-action-primary">
          {connected ? (
            <div className="control-mode-switch" role="group" aria-label="控制模式">
              <button
                type="button"
                className={!inputControlActive ? "is-active" : ""}
                aria-pressed={!inputControlActive}
                onClick={() => {
                  if (inputControlActive) onToggleInputControl();
                }}
              >
                <Eye size={16} />
                仅查看
              </button>
              <button
                type="button"
                className={inputControlActive ? "is-active" : ""}
                aria-pressed={inputControlActive}
                onClick={() => {
                  if (!inputControlActive) onToggleInputControl();
                }}
              >
                <MousePointerClick size={16} />
                控制中
              </button>
            </div>
          ) : (
            <button className="primary-action-button" onClick={onNextAction} disabled={nextAction.disabled}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <PlugZap size={17} />}
              {nextAction.label}
            </button>
          )}
        </div>
        {!connected && nextAction.detail ? <p className="operation-note">{nextAction.detail}</p> : null}
        <div className="command-action-group command-action-tools" aria-label="远控工具栏">
          <button onClick={() => onStageViewModeChange(nextStageMode)}>
            <Scan size={17} />
            {remoteStageViewMode === "fit" ? "填充画面" : "适应画面"}
          </button>
          <button onClick={onToggleFullscreen}>
            <Maximize2 size={17} />
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
          <RemoteShortcutMenu disabled={!inputControlActive} platformKey={remoteShortcutPlatform} onRemoteShortcut={onRemoteShortcut} />
        </div>
      </section>
      {dockedEdge ? (
        <button
          type="button"
          className={`command-bar-dock-tab dock-tab-${dockedEdge}`}
          style={dockTabStyle}
          aria-label="恢复工具栏"
          title="恢复工具栏"
          onClick={restoreFromEdge}
        >
          <DockTabIcon size={12} />
        </button>
      ) : null}
    </>
  );
}
