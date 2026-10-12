import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type FloatingPanelPosition = {
  left: number;
  top: number;
};

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type DockedEdge = "left" | "right" | "top" | "bottom";

type DockedState = {
  edge: DockedEdge;
  // 恢复按钮沿停靠边的偏移(半圆中心在该边上的坐标)。
  tabOffset: number;
  // 隐藏前面板的位置与尺寸，恢复时按当前窗口大小重新钳制；
  // restore 为 null 表示隐藏前未拖动过(进入全屏时自动贴顶)，恢复时回到 CSS 原位。
  restore: FloatingPanelPosition | null;
  size: { width: number; height: number };
};

// 拖动结束时面板中心到窗口边缘小于该距离视为"贴边"，吸附隐藏。
const DOCK_SNAP_DISTANCE = 32;
// 半圆恢复按钮沿边方向的长度(直径)与垂直于边方向的厚度。
const DOCK_TAB_LENGTH = 34;
const DOCK_TAB_MARGIN = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function detectEdgeDock(left: number, top: number, width: number, height: number): DockedState | null {
  const candidates = [
    { edge: "left" as const, distance: left, tabOffset: top + height / 2 },
    { edge: "right" as const, distance: window.innerWidth - (left + width), tabOffset: top + height / 2 },
    { edge: "top" as const, distance: top, tabOffset: left + width / 2 },
    { edge: "bottom" as const, distance: window.innerHeight - (top + height), tabOffset: left + width / 2 },
  ].sort((a, b) => a.distance - b.distance);
  const nearest = candidates[0];
  if (!nearest || nearest.distance > DOCK_SNAP_DISTANCE) return null;
  const axisLength = nearest.edge === "left" || nearest.edge === "right" ? window.innerHeight : window.innerWidth;
  const half = DOCK_TAB_LENGTH / 2;
  return {
    edge: nearest.edge,
    tabOffset: clamp(nearest.tabOffset, half + DOCK_TAB_MARGIN, Math.max(half + DOCK_TAB_MARGIN, axisLength - half - DOCK_TAB_MARGIN)),
    restore: { left, top },
    size: { width, height },
  };
}

export function useDraggableFloatingPanel<T extends HTMLElement>(enabled = true) {
  const panelRef = useRef<T | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null);
  const [docked, setDocked] = useState<DockedState | null>(null);

  // 关闭拖拽（如退出全屏）时清掉自定义坐标与停靠状态，让工具栏回到 CSS 中定义的固定原位；
  // 开启拖拽（如进入全屏）时自动贴顶隐藏，避免面板遮挡画面，点击半圆恢复按钮回到原位。
  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setDocked(null);
      return;
    }
    setDocked({
      edge: "top",
      tabOffset: window.innerWidth / 2,
      restore: null,
      size: { width: 0, height: 0 },
    });
  }, [enabled]);

  const panelStyle = useMemo<CSSProperties | undefined>(() => {
    if (!enabled) return undefined;
    // 停靠隐藏时面板整体不渲染，只留半圆恢复按钮。
    if (docked) return { position: "fixed", display: "none" };
    if (!position) return undefined;
    // 拖动后用 position:fixed + 视口坐标，使工具栏可以移出画面区域、停到窗口任意位置。
    return {
      position: "fixed",
      left: `${position.left}px`,
      top: `${position.top}px`,
      transform: "none",
    };
  }, [enabled, position, docked]);

  const dockTabStyle = useMemo<CSSProperties | undefined>(() => {
    if (!docked) return undefined;
    // 左右停靠：半圆在水平边缘上滑动(top)；上下停靠：在垂直边缘上滑动(left)。
    if (docked.edge === "left" || docked.edge === "right") {
      return { top: `${docked.tabOffset}px`, transform: "translateY(-50%)" };
    }
    return { left: `${docked.tabOffset}px`, transform: "translateX(-50%)" };
  }, [docked]);

  const restoreFromEdge = useCallback(() => {
    if (!docked) return;
    // 进入全屏时自动贴顶隐藏没有隐藏前坐标，恢复即回到 CSS 原位（全屏下为顶部居中）。
    if (docked.restore) {
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - docked.size.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - docked.size.height - margin);
      setPosition({
        left: clamp(docked.restore.left, margin, maxLeft),
        top: clamp(docked.restore.top, margin, maxTop),
      });
    }
    setDocked(null);
  }, [docked]);

  const moveToPointer = useCallback((clientX: number, clientY: number) => {
    const panel = panelRef.current;
    const dragState = dragStateRef.current;
    if (!panel || !dragState) return;

    // 以视口为边界（而非父容器），允许拖出远控画面，仅约束在窗口内避免拖丢。
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - panelRect.height - margin);

    setPosition({
      left: clamp(clientX - dragState.offsetX, margin, maxLeft),
      top: clamp(clientY - dragState.offsetY, margin, maxTop),
    });
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
    };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events used by tests do not always create an active pointer.
    }
    event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      moveToPointer(event.clientX, event.clientY);
      event.preventDefault();
    },
    [moveToPointer],
  );

  const finishDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (dragState?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // The pointer may already be released by the browser or a test harness.
    }
    // 用 pointerup 坐标同步计算最终位置(setState 可能还没渲染完)，据此做贴边吸附检测。
    const panel = panelRef.current;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      const margin = 8;
      const left = clamp(event.clientX - dragState.offsetX, margin, Math.max(margin, window.innerWidth - rect.width - margin));
      const top = clamp(event.clientY - dragState.offsetY, margin, Math.max(margin, window.innerHeight - rect.height - margin));
      const nextDocked = detectEdgeDock(left, top, rect.width, rect.height);
      if (nextDocked) {
        setDocked(nextDocked);
        event.preventDefault();
        return;
      }
    }
    event.preventDefault();
  }, []);

  return {
    panelRef,
    panelStyle,
    dragHandleProps: {
      onPointerCancel: finishDrag,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
    },
    dockedEdge: docked?.edge ?? null,
    dockTabStyle,
    restoreFromEdge,
  };
}
