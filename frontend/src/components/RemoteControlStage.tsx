import { Monitor } from "lucide-react";

import type { RemoteControlPageProps } from "../app/remoteControlPageProps.js";
import { RemoteVideoTile } from "./RemoteVideoTile.js";

export function RemoteControlStage({
  hasRemoteVideo,
  inputControlActive,
  onRemoteStageKeyDown,
  onRemoteStageKeyUp,
  onRemoteStageBlur,
  onRemoteStagePaste,
  onRemoteStagePointerCancel,
  onRemoteStagePointerDown,
  onRemoteStagePointerMove,
  onRemoteStagePointerUp,
  onRemoteStageWheel,
  onRemoteVideoSample,
  primaryRemoteVideoActive,
  primaryRemoteVideoId,
  remoteStageRef,
  remoteStageViewMode,
  remoteVideoStreams,
  selectedDevice,
  stageStatusLabel,
}: Pick<
  RemoteControlPageProps,
  | "hasRemoteVideo"
  | "inputControlActive"
  | "onRemoteStageKeyDown"
  | "onRemoteStageKeyUp"
  | "onRemoteStageBlur"
  | "onRemoteStagePaste"
  | "onRemoteStagePointerCancel"
  | "onRemoteStagePointerDown"
  | "onRemoteStagePointerMove"
  | "onRemoteStagePointerUp"
  | "onRemoteStageWheel"
  | "onRemoteVideoSample"
  | "primaryRemoteVideoActive"
  | "primaryRemoteVideoId"
  | "remoteStageRef"
  | "remoteStageViewMode"
  | "remoteVideoStreams"
  | "selectedDevice"
  | "stageStatusLabel"
>) {
  return (
    <div
      ref={remoteStageRef}
      className={`remote-stage control-remote-stage remote-stage-${remoteStageViewMode} ${inputControlActive ? "remote-stage-interactive" : ""}`}
      role="application"
      aria-label="远控画面"
      tabIndex={0}
      onPointerDown={onRemoteStagePointerDown}
      onPointerMove={onRemoteStagePointerMove}
      onPointerUp={onRemoteStagePointerUp}
      onPointerCancel={onRemoteStagePointerCancel}
      onWheel={onRemoteStageWheel}
      onContextMenu={(event) => {
        // 已解锁输入时，拦截浏览器右键菜单：否则原生菜单会吞掉 pointerup，
        // 导致“抬起右键”发不出去、被控端右键卡死、之后左键都被当右键。
        if (inputControlActive) event.preventDefault();
      }}
      onKeyDown={onRemoteStageKeyDown}
      onKeyUp={onRemoteStageKeyUp}
      onBlur={onRemoteStageBlur}
      onPaste={onRemoteStagePaste}
    >
      {hasRemoteVideo ? (
        <>
          <div className="remote-video-grid">
            {remoteVideoStreams.map((video, index) => (
              <RemoteVideoTile
                key={video.id}
                videoId={video.id}
                index={index}
                visible={video.id === primaryRemoteVideoId}
                stream={video.stream}
                onVideoSample={onRemoteVideoSample}
              />
            ))}
          </div>
          {!primaryRemoteVideoActive ? (
            <div className="stage-center stage-center--overlay">
              <Monitor size={34} />
              <strong>该画面暂无内容</strong>
              <span>这一路当前没有画面输出，可在右侧「画面源」切换到其他画面。</span>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="stage-grid" />
          <div className="stage-center">
            <Monitor size={34} />
            <strong>{selectedDevice?.alias ?? "未选择设备"}</strong>
            <span>{stageStatusLabel}</span>
          </div>
        </>
      )}
    </div>
  );
}
