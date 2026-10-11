import {
  STREAMER_DATA_CHANNEL_LABELS,
  STREAMER_ICE_NETWORK_TYPES,
  buildStreamerMouseButtonInputMessage,
  buildStreamerKeyboardInputMessage,
  buildStreamerMacKeyboardInputMessage,
  buildStreamerWindowsKeyboardInputMessage,
  buildStreamerTextInputMessage,
  buildStreamerMacMouseMoveAbsoluteInputMessage,
  buildStreamerMacMouseScrollInputMessage,
  buildStreamerMouseMoveAbsoluteInputMessage,
  buildStreamerMouseScrollInputMessage,
  buildStreamerRtcConfiguration,
  classifyStreamerConnectionPath,
  decodeStreamerControlMessage,
  encodeStreamerEchoResponseMessage,
  encodeStreamerEchoRequestMessage,
  encodeStreamerInputMessage,
  encodeStreamerTextMessage,
  formatStreamerSignalControlFailure,
  getStreamerSignalControlFailure,
  STREAMER_ROM_MESSAGE_TYPES,
  STREAMER_SIMPLE_ACTION_TYPES,
  type DecodedStreamerControlMessage,
  type StreamerConnectionPath,
  type StreamerDataChannelLabel,
  type StreamerIceNetworkType,
  type StreamerMouseButtonKind,
  type StreamerSignalControlResult,
} from "@uurc/shared/streamerProtocol";
import type {
  RemoteSignalControlRequest,
  RemoteSignalControlResult,
  RemoteSignalGatewayEvent,
  RemoteSignalSoacRequest,
  RemoteSignalSoacResult,
} from "@uurc/shared/types";

export interface BrowserRemoteSessionApi {
  sendSignalControl(input: RemoteSignalControlRequest): Promise<RemoteSignalControlResult>;
  sendSignalSoac(input: RemoteSignalSoacRequest): Promise<RemoteSignalSoacResult>;
}

export interface BrowserRemotePeerConnection {
  localDescription: RTCSessionDescriptionInit | null;
  remoteDescription: RTCSessionDescriptionInit | null;
  signalingState?: RTCSignalingState;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  createDataChannel(label: string): BrowserRemoteDataChannel;
  addTransceiver(kind: "audio" | "video", init?: RTCRtpTransceiverInit): RTCRtpTransceiver;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  close?: () => void;
  getStats?: () => Promise<BrowserRemoteStatsReport>;
  restartIce?: () => void;
}

export interface BrowserRemoteDataChannel {
  label: string;
  readyState: RTCDataChannelState;
  binaryType?: BinaryType;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage?: ((event: MessageEvent) => void) | null;
  close?: () => void;
  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void;
}

export interface BrowserRemoteSessionOptions {
  api: BrowserRemoteSessionApi;
  createPeerConnection?: (configuration: RTCConfiguration) => BrowserRemotePeerConnection;
  getVideoCodecPreferences?: () => RTCRtpCodec[];
  now?: () => number;
  onRemoteStream?: (stream: MediaStream) => void;
  onRemoteClipboard?: (text: string) => void;
  onStateChange?: (state: BrowserRemoteSessionState) => void;
}

export type BrowserRemoteStatsReport = {
  forEach(callback: (value: unknown, key: string) => void): void;
  get?(key: string): unknown;
};

export interface BrowserRemoteSessionStartInput extends RemoteSignalControlRequest {
  iceId?: string;
  iceNetworkType?: StreamerIceNetworkType;
  forceRelay?: boolean;
  gzipSdp?: boolean;
  targetPlatform?: number;
}

export interface BrowserRemoteMousePositionInput {
  absX: number;
  absY: number;
  surfaceWidth?: number;
  surfaceHeight?: number;
}

export interface BrowserRemoteMouseClickInput extends BrowserRemoteMousePositionInput {
  button?: StreamerMouseButtonKind | number;
}

export interface BrowserRemoteMouseButtonInput {
  action: "mousePress" | "mouseRelease" | "mouseClick";
  button?: StreamerMouseButtonKind | number;
}

export interface BrowserRemoteMouseScrollInput {
  deltaX: number;
  deltaY: number;
}

export interface BrowserRemoteKeyboardInput {
  action: "keyboardPress" | "keyboardRelease" | "keyboardClick";
  value: string | number;
}

export interface BrowserRemoteSelectedCandidatePair {
  localCandidateType?: string;
  remoteCandidateType?: string;
  localAddress?: string;
  remoteAddress?: string;
  protocol?: string;
  bytesReceived?: number;
  bytesSent?: number;
  currentRoundTripTime?: number;
  availableIncomingBitrate?: number;
  availableOutgoingBitrate?: number;
}

export interface BrowserRemoteInboundVideoStats {
  codecId?: string;
  codecMimeType?: string;
  codecPayloadType?: number;
  decoderImplementation?: string;
  powerEfficientDecoder?: boolean;
  packetsReceived?: number;
  packetsLost?: number;
  bytesReceived?: number;
  framesDecoded?: number;
  framesReceived?: number;
  framesDropped?: number;
  keyFramesDecoded?: number;
  freezeCount?: number;
  totalFreezesDuration?: number;
  pauseCount?: number;
  totalPausesDuration?: number;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  nackCount?: number;
  pliCount?: number;
  firCount?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesAssembledFromMultiplePackets?: number;
  totalAssemblyTime?: number;
  timestampMs?: number;
}

export interface BrowserRemoteVideoElementSample {
  event: string;
  currentTimeMs: number;
  totalVideoFrames?: number;
  droppedVideoFrames?: number;
  readyState?: number;
  paused?: boolean;
  ended?: boolean;
  width?: number;
  height?: number;
}

export interface BrowserRemoteVideoFlowDelta {
  packetsReceived?: number;
  bytesReceived?: number;
  framesDecoded?: number;
  framesReceived?: number;
  framesDropped?: number;
  keyFramesDecoded?: number;
  pliCount?: number;
  nackCount?: number;
  firCount?: number;
  freezeCount?: number;
  sampleIntervalMs?: number;
  candidateBytesReceived?: number;
  candidateBytesSent?: number;
  videoElementFrames?: number;
  videoElementTimeMs?: number;
}

export interface BrowserRemoteVideoFlowDiagnostics {
  status: "waiting" | "receiving" | "decode_stalled" | "transport_stalled";
  title: string;
  detail: string;
  delta?: BrowserRemoteVideoFlowDelta;
  updatedAtMs: number;
}

export type BrowserRemoteDebugEventKind =
  | "session"
  | "signal"
  | "data_channel"
  | "data_send"
  | "data_recv"
  | "stats"
  | "video_element";

export interface BrowserRemoteDebugEvent {
  id: number;
  atMs: number;
  kind: BrowserRemoteDebugEventKind;
  summary: string;
  details?: Record<string, unknown>;
}

export interface BrowserRemoteSessionState {
  appControlId: string;
  clientId?: string;
  connectionPath: StreamerConnectionPath;
  controlIceIdMatch?: boolean;
  controlResult?: StreamerSignalControlResult;
  controlResultIceId?: string;
  dataChannels: Partial<Record<StreamerDataChannelLabel, RTCDataChannelState>>;
  debugEvents: BrowserRemoteDebugEvent[];
  iceId?: string;
  inboundVideo?: BrowserRemoteInboundVideoStats;
  remoteTrackCount: number;
  remoteDisplayId?: number;
  remoteInputDisplayId?: number;
  selectedCandidatePair?: BrowserRemoteSelectedCandidatePair;
  stage: "idle" | "controlled" | "offered" | "connected";
  videoElement?: BrowserRemoteVideoElementSample;
  videoFlow?: BrowserRemoteVideoFlowDiagnostics;
}

type SwitchNetworkNotify = {
  transportType?: StreamerIceNetworkType;
  iceId?: string;
};

// 修饰键的键盘值：ANDROID_KEY_CODES_BY_DOM_CODE 中按住型修饰键的 Android keycode
// （Alt=57/58、Shift=59/60、Ctrl=113/114、Meta/Win=117/118），
// 外加 event.code 缺失时 toAndroidKeyCodeFromDomEvent 回退出的 key 字符串。
const REMOTE_MODIFIER_KEY_VALUES = new Set<string | number>([
  57, 58, 59, 60, 113, 114, 117, 118,
  "Shift", "Control", "Alt", "Meta", "AltGraph",
]);

export class BrowserRemoteSession {
  private static readonly maxDebugEvents = 120;
  private static readonly echoHeartbeatIntervalMs = 100;
  private static readonly echoHeartbeatDebugIntervalMs = 30000;
  private static readonly dataReceiveDebugIntervalMs = 30000;

  private readonly createPeerConnection: (configuration: RTCConfiguration) => BrowserRemotePeerConnection;
  private readonly getVideoCodecPreferences: () => RTCRtpCodec[];
  private readonly now: () => number;
  private peer: BrowserRemotePeerConnection | null = null;
  private readonly dataChannels = new Map<StreamerDataChannelLabel, BrowserRemoteDataChannel>();
  private echoHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private lastEchoHeartbeatDebugAtMs = 0;
  private readonly lastDataReceiveDebugAtMs = new Map<StreamerDataChannelLabel, number>();
  private debugEventId = 1;
  private debugEvents: BrowserRemoteDebugEvent[] = [];
  private appControlId = "";
  private clientId: string | undefined;
  private iceId: string | undefined;
  private gzipSdp = true;
  private iceNetworkType: StreamerIceNetworkType = STREAMER_ICE_NETWORK_TYPES.appAuto;
  private targetPlatform: number | undefined;
  private readonly processedSignalEventIds = new Set<number>();
  private queuedCandidates: RTCIceCandidateInit[] = [];
  private remoteStream: MediaStream | null = null;
  private remoteDisplayId: number | undefined;
  private remoteInputDisplayId: number | undefined;
  private sequence = 1;
  private readonly heldKeyboardValues = new Set<string | number>();
  private readonly heldMouseButtons = new Set<StreamerMouseButtonKind | number>();
  private previousStatsSample:
    | {
        inboundVideo?: BrowserRemoteInboundVideoStats;
        sampledAtMs: number;
        selectedCandidatePair?: BrowserRemoteSelectedCandidatePair;
      }
    | undefined;
  private previousVideoElementSample: BrowserRemoteVideoElementSample | undefined;
  private state: BrowserRemoteSessionState = {
    appControlId: "",
    connectionPath: "unknown",
    dataChannels: {},
    debugEvents: [],
    remoteTrackCount: 0,
    stage: "idle",
  };

  constructor(private readonly options: BrowserRemoteSessionOptions) {
    this.createPeerConnection =
      options.createPeerConnection ??
      ((configuration) => new RTCPeerConnection(configuration) as BrowserRemotePeerConnection);
    this.getVideoCodecPreferences = options.getVideoCodecPreferences ?? getBrowserH264CodecPreferences;
    this.now = options.now ?? Date.now;
  }

  private streamerTimestampSeconds(): number {
    return Math.floor(this.now() / 1000);
  }

  getState(): BrowserRemoteSessionState {
    return {
      ...this.state,
      dataChannels: { ...this.state.dataChannels },
      debugEvents: [...this.debugEvents],
      inboundVideo: this.state.inboundVideo ? { ...this.state.inboundVideo } : undefined,
      selectedCandidatePair: this.state.selectedCandidatePair ? { ...this.state.selectedCandidatePair } : undefined,
      videoElement: this.state.videoElement ? { ...this.state.videoElement } : undefined,
      videoFlow: this.state.videoFlow
        ? {
            ...this.state.videoFlow,
            delta: this.state.videoFlow.delta ? { ...this.state.videoFlow.delta } : undefined,
          }
        : undefined,
    };
  }

  close(): BrowserRemoteSessionState {
    this.recordDebugEvent("session", "关闭浏览器远控会话", {
      stage: this.state.stage,
      appControlId: this.appControlId || undefined,
      iceId: this.iceId,
    });
    this.stopEchoHeartbeat();
    for (const channel of this.dataChannels.values()) {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.onmessage = null;
      if (channel.readyState !== "closed") {
        channel.close?.();
      }
    }
    this.dataChannels.clear();
    this.lastDataReceiveDebugAtMs.clear();
    this.peer?.close?.();
    this.peer = null;
    this.appControlId = "";
    this.clientId = undefined;
    this.iceId = undefined;
    this.targetPlatform = undefined;
    this.processedSignalEventIds.clear();
    this.queuedCandidates = [];
    this.remoteStream = null;
    this.remoteDisplayId = undefined;
    this.remoteInputDisplayId = undefined;
    this.sequence = 1;
    this.heldKeyboardValues.clear();
    this.heldMouseButtons.clear();
    this.previousStatsSample = undefined;
    this.previousVideoElementSample = undefined;
    this.setState({
      appControlId: "",
      connectionPath: "unknown",
      dataChannels: {},
      debugEvents: this.debugEvents,
      remoteTrackCount: 0,
      stage: "idle",
    });
    return this.getState();
  }

  async start(input: BrowserRemoteSessionStartInput): Promise<BrowserRemoteSessionState> {
    this.recordDebugEvent("session", "启动 signal control", {
      appControlId: input.appControlId,
      gzipSdp: input.gzipSdp ?? true,
      forceRelay: input.forceRelay ?? false,
    });
    const control = await this.options.api.sendSignalControl({
      appControlId: input.appControlId,
      appDataBase64: input.appDataBase64,
      streamerData: input.streamerData,
    });
    const result = control.control.result;
    if (!result) {
      throw new Error("signal control ack did not include a ControlResult");
    }
    const failure = getStreamerSignalControlFailure(control.control);
    if (failure) {
      throw new Error(`signal control ack failed: ${formatStreamerSignalControlFailure(failure)}`);
    }

    this.appControlId = input.appControlId;
    this.clientId = result.clientId;
    this.iceId = result.iceId ?? input.iceId;
    this.gzipSdp = input.gzipSdp ?? true;
    this.iceNetworkType = input.iceNetworkType ?? STREAMER_ICE_NETWORK_TYPES.appAuto;
    this.targetPlatform = input.targetPlatform;
    this.processedSignalEventIds.clear();
    this.peer = this.createPeerConnection(buildStreamerRtcConfiguration(result, { forceRelay: input.forceRelay === true }));
    this.createStreamerDataChannels(this.peer);
    this.createStreamerMediaTransceivers(this.peer);
    this.peer.onicecandidate = (event) => {
      void this.sendLocalCandidate(event.candidate?.toJSON?.() ?? null);
    };
    this.peer.ontrack = (event) => this.applyRemoteTrack(event);

    this.setState({
      appControlId: input.appControlId,
      clientId: result.clientId,
      connectionPath: "unknown",
      controlIceIdMatch:
        input.iceId && result.iceId
          ? input.iceId === result.iceId
          : undefined,
      controlResult: result,
      controlResultIceId: result.iceId,
      dataChannels: this.getDataChannelStates(),
      debugEvents: this.debugEvents,
      iceId: this.iceId,
      remoteTrackCount: 0,
      stage: "controlled",
    });
    this.recordDebugEvent("session", "control ack 成功", {
      clientId: this.clientId,
      iceId: this.iceId,
      iceServers: result.iceServers.length,
      forceRelay: result.forceRelay,
      autoSwitchNetwork: result.autoSwitchNetwork,
      targetPlatform: this.targetPlatform,
    });

    await this.createAndSendLocalOffer();

    this.setState({
      ...this.state,
      stage: "offered",
    });
    return this.getState();
  }

  sendTextData(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const sequence = this.sequence;
    const timestampSeconds = this.streamerTimestampSeconds();
    const payload = encodeStreamerTextMessage({
      sequence,
      timestampMs: timestampSeconds,
      inputMessage: trimmed,
      displayId: this.remoteInputDisplayId,
    });
    this.sequence += 1;
    this.sendDataChannel(STREAMER_DATA_CHANNEL_LABELS.text, payload, {
      summary: "发送文本输入",
      details: {
        sequence,
        timestampSeconds,
        textLength: trimmed.length,
        inputDisplayId: this.remoteInputDisplayId,
        remoteDisplayId: this.remoteDisplayId,
        targetPlatform: this.targetPlatform,
      },
    });
  }

  // 剪贴板文本按被控端平台路由：
  // - 桌面被控端走控制通道裸 JSON text_input（与远端打字一致，真机抓包验证）；
  //   TEXT_DATA_CHANNEL 上的 RomMsg_Text 二进制帧是安卓被控端协议，桌面端不解析，
  //   控制桌面时走文本通道会导致剪贴板“发送成功但被控端无反应”。
  // - 安卓/模拟器维持文本通道 RomMsg_Text。
  //
  // 发送前先释放当前按住的修饰键、发完再恢复：Ctrl+V 时本机已把 Ctrl 以“按住”转发给被控端，
  // 而 text_input 是逐字符上屏（打字语义），被控端 Ctrl 尚未松开时每个字母都会变成
  // Ctrl+字母（触发保存/剪切/打印等编辑器快捷键，安卓终端上则是乱码控制符）。
  sendClipboardText(text: string): void {
    if (!text) return;
    const heldModifiers = [...this.heldKeyboardValues].filter((value) => REMOTE_MODIFIER_KEY_VALUES.has(value));
    for (const value of heldModifiers) this.sendKeyboardInput({ action: "keyboardRelease", value });
    try {
      if (isDesktopPlatform(this.targetPlatform)) {
        this.sendTextInput(text);
        return;
      }
      this.sendTextData(text);
    } finally {
      for (const value of heldModifiers) {
        try {
          this.sendKeyboardInput({ action: "keyboardPress", value });
        } catch {
          // 恢复失败忽略：通道已关闭时由重连/释放流程兜底。
        }
      }
    }
  }

  sendMouseClick(input: BrowserRemoteMouseClickInput): void {
    const button = input.button ?? "primary";
    this.sendMouseMove(input);
    this.sendMouseButton({ action: "mousePress", button });
    this.sendMouseButton({ action: "mouseRelease", button });
  }

  sendMouseMove(input: BrowserRemoteMousePositionInput): void {
    this.sendInputData(this.buildMouseMoveAbsoluteInput(input));
  }

  sendMouseButton(input: BrowserRemoteMouseButtonInput): void {
    const button = input.button ?? "primary";
    // 桌面被控端不响应 XBUTTON 侧键（back=8/forward=16，安卓触摸语义），
    // 改发通用键盘等价物：资源管理器/浏览器中 Alt+Left/Right 即后退/前进。安卓保持原生侧键。
    // 一次物理点击会先后来 press/release 两个事件，只在按下时合成一次，抬起事件忽略，否则走两步。
    if (isDesktopPlatform(this.targetPlatform) && (button === "back" || button === "forward")) {
      if (input.action !== "mousePress") return;
      const arrow = button === "back" ? 21 : 22; // ArrowLeft / ArrowRight
      this.sendKeyboardInput({ action: "keyboardPress", value: 57 }); // AltLeft
      this.sendKeyboardInput({ action: "keyboardPress", value: arrow });
      this.sendKeyboardInput({ action: "keyboardRelease", value: arrow });
      this.sendKeyboardInput({ action: "keyboardRelease", value: 57 });
      return;
    }
    if (input.action === "mousePress") this.heldMouseButtons.add(button);
    else if (input.action === "mouseRelease") this.heldMouseButtons.delete(button);
    this.sendInputData(buildStreamerMouseButtonInputMessage({ action: input.action, button }));
  }

  sendMouseScroll(input: BrowserRemoteMouseScrollInput): void {
    this.sendInputData(isDesktopPlatform(this.targetPlatform) ? buildStreamerMacMouseScrollInputMessage(input) : buildStreamerMouseScrollInputMessage(input));
  }

  sendKeyboardInput(input: BrowserRemoteKeyboardInput): void {
    if (input.action === "keyboardPress") this.heldKeyboardValues.add(input.value);
    else if (input.action === "keyboardRelease") this.heldKeyboardValues.delete(input.value);
    this.sendInputData(this.buildKeyboardInput(input));
  }

  // 直接上屏一段字符(text_input)。桌面被控端打字用它替代逐键 kbd_press，避免字母连发；
  // 走与其他控制输入相同的 sendInputData 通道(桌面为裸 JSON)。
  sendTextInput(content: string): void {
    if (!content) return;
    this.sendInputData(buildStreamerTextInputMessage(content));
  }

  releaseAllInputs(): void {
    // 兜底：把当前“按住”的鼠标键与键盘键全部抬起。避免失焦 / 右键菜单 / 系统快捷键吞掉
    // pointerup/keyup 后，在被控端留下卡住的按键（右键卡死、Alt 卡死等）。
    const buttons = [...this.heldMouseButtons];
    this.heldMouseButtons.clear();
    const keys = [...this.heldKeyboardValues];
    this.heldKeyboardValues.clear();
    for (const button of buttons) {
      try {
        this.sendInputData(buildStreamerMouseButtonInputMessage({ action: "mouseRelease", button }));
      } catch {
        // 通道可能已关闭，忽略。
      }
    }
    for (const value of keys) {
      try {
        this.sendInputData(this.buildKeyboardInput({ action: "keyboardRelease", value }));
      } catch {
        // 忽略。
      }
    }
  }

  async refreshConnectionStats(): Promise<BrowserRemoteSessionState> {
    if (!this.peer?.getStats) return this.getState();

    const report = await this.peer.getStats();
    const sampledAtMs = this.now();
    const previousFlowStatus = this.state.videoFlow?.status;
    const selectedCandidatePair = readSelectedCandidatePair(report);
    const inboundVideo = readInboundVideoStats(report);
    const videoFlow = diagnoseVideoFlow({
      nowMs: sampledAtMs,
      previous: this.previousStatsSample,
      current: {
        inboundVideo,
        sampledAtMs,
        selectedCandidatePair: selectedCandidatePair.pair,
      },
      previousVideoElement: this.previousVideoElementSample,
      currentVideoElement: this.state.videoElement,
    });
    this.previousStatsSample = {
      inboundVideo,
      sampledAtMs,
      selectedCandidatePair: selectedCandidatePair.pair,
    };
    this.setState({
      ...this.state,
      connectionPath: selectedCandidatePair.connectionPath,
      inboundVideo,
      selectedCandidatePair: selectedCandidatePair.pair,
      videoFlow,
    });
    this.recordDebugEvent("stats", videoFlow.title, {
      status: videoFlow.status,
      delta: videoFlow.delta,
      inboundVideo,
      selectedCandidatePair: selectedCandidatePair.pair,
    });
    // 诊断：画面从“正常”转入停滞时打一条醒目日志，便于在浏览器控制台定位“卡死那一刻”的成因。
    if (
      videoFlow.status !== previousFlowStatus &&
      (videoFlow.status === "transport_stalled" || videoFlow.status === "decode_stalled")
    ) {
      console.warn(
        `[uurc] 画面停滞 → ${videoFlow.status}（${videoFlow.detail}）` +
          ` path=${selectedCandidatePair.connectionPath}` +
          ` control=${this.state.dataChannels[STREAMER_DATA_CHANNEL_LABELS.control] ?? "?"}`,
        { delta: videoFlow.delta, candidatePair: selectedCandidatePair.pair, inboundVideo },
      );
    }
    return this.getState();
  }

  recordVideoElementSample(sample: BrowserRemoteVideoElementSample): BrowserRemoteSessionState {
    const previousPrimarySample = this.state.videoElement;
    const sampleIsActive = isActiveVideoElementSample(sample);
    const previousSampleIsActive = isActiveVideoElementSample(previousPrimarySample);
    const shouldUseSample = sampleIsActive || !previousSampleIsActive;
    if (!shouldUseSample) return this.getState();

    const nextPrimarySample = sample;

    const delta = diffVideoElementSample(this.previousVideoElementSample, nextPrimarySample);
    this.previousVideoElementSample = nextPrimarySample;
    const videoFlow =
      positive(delta.videoElementFrames) || positive(delta.videoElementTimeMs)
        ? {
            status: "receiving" as const,
            title: "Video 元素帧在增长",
            detail: formatVideoFlowDelta(dropUndefinedFields(delta) as BrowserRemoteVideoFlowDelta),
            delta: dropUndefinedFields(delta) as BrowserRemoteVideoFlowDelta,
            updatedAtMs: this.now(),
          }
        : this.state.videoFlow ??
          diagnoseVideoFlow({
            nowMs: this.now(),
            previous: this.previousStatsSample,
            current: {
              inboundVideo: this.state.inboundVideo,
              sampledAtMs: this.now(),
              selectedCandidatePair: this.state.selectedCandidatePair,
            },
            previousVideoElement: this.state.videoElement,
            currentVideoElement: nextPrimarySample,
          });
    this.setState({
      ...this.state,
      videoElement: nextPrimarySample,
      videoFlow,
    });
    if (
      sample.event !== "sample" ||
      positive(delta.videoElementFrames) ||
      positive(delta.videoElementTimeMs) ||
      (sampleIsActive && !previousSampleIsActive)
    ) {
      this.recordDebugEvent("video_element", `video ${sample.event}`, {
        ...sample,
        delta,
      });
    }
    return this.getState();
  }

  async applySignalEvents(events: RemoteSignalGatewayEvent[]): Promise<void> {
    for (const event of events) {
      if (this.processedSignalEventIds.has(event.id)) continue;
      if (event.direction !== "inbound") continue;
      if (event.event === "soac") {
        this.recordDebugEvent("signal", "收到 SOAC", summarizeSignalEvent(event));
        const payloads = Array.isArray(event.payload) ? event.payload : [event.payload];
        for (const payload of payloads) {
          await this.applySoacPayload(payload);
        }
        this.processedSignalEventIds.add(event.id);
        continue;
      }
      if (event.event === "switch_network_notify") {
        this.recordDebugEvent("signal", "收到切网通知", summarizeSignalEvent(event));
        await this.applySwitchNetworkNotify(event.payload);
        this.processedSignalEventIds.add(event.id);
        continue;
      }
      if (event.event === "forward_setting" || event.event === "device_capability") {
        this.applyRemoteDisplayCapability(event);
        this.processedSignalEventIds.add(event.id);
      }
    }
  }

  private createStreamerDataChannels(peer: BrowserRemotePeerConnection): void {
    for (const label of Object.values(STREAMER_DATA_CHANNEL_LABELS)) {
      const channel = peer.createDataChannel(label);
      channel.binaryType = "arraybuffer";
      channel.onopen = () => {
        this.recordDebugEvent("data_channel", `${label} open`, { label, readyState: channel.readyState });
        this.updateDataChannelState(label);
        if (label === STREAMER_DATA_CHANNEL_LABELS.control) {
          this.startEchoHeartbeat();
        }
      };
      channel.onclose = () => {
        this.recordDebugEvent("data_channel", `${label} close`, { label, readyState: channel.readyState });
        if (label === STREAMER_DATA_CHANNEL_LABELS.control) {
          console.warn(`[uurc] 控制数据通道关闭（${label}）→ 心跳停止，被控端可能停推画面`);
          this.stopEchoHeartbeat();
        }
        this.updateDataChannelState(label);
      };
      channel.onerror = () => {
        this.recordDebugEvent("data_channel", `${label} error`, { label, readyState: channel.readyState });
        if (label === STREAMER_DATA_CHANNEL_LABELS.control) {
          console.warn(`[uurc] 控制数据通道错误（${label}），readyState=${channel.readyState}`);
          this.stopEchoHeartbeat();
        }
        this.updateDataChannelState(label);
      };
      channel.onmessage = (event) => {
        this.recordDataChannelMessage(label, event.data);
      };
      this.dataChannels.set(label, channel);
    }
  }

  private createStreamerMediaTransceivers(peer: BrowserRemotePeerConnection): void {
    const videoCodecs = this.getVideoCodecPreferences();
    for (let index = 0; index < 5; index += 1) {
      const transceiver = peer.addTransceiver("video", { direction: "recvonly" });
      applyVideoCodecPreferences(transceiver, videoCodecs);
    }
    peer.addTransceiver("audio", { direction: "recvonly" });
  }

  private async sendLocalCandidate(candidate: RTCIceCandidateInit | null): Promise<void> {
    if (!candidate?.candidate) return;
    this.recordDebugEvent("signal", "发送本地 candidate", {
      appControlId: this.appControlId,
      clientId: this.clientId,
      iceId: this.iceId,
      sdpMid: candidate.sdpMid ?? undefined,
      sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
      candidateType: extractCandidateType(candidate.candidate),
    });
    await this.options.api.sendSignalSoac({
      type: "candidate",
      clientId: this.clientId,
      iceId: this.iceId,
      appControlId: this.appControlId,
      candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? undefined,
        sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
      },
    });
  }

  private async applySoacPayload(payload: unknown): Promise<void> {
    if (!this.peer) return;

    const record = asRecord(payload);
    const data = asRecord(record?.data);
    if (!this.isCurrentSoacPayload(record, data)) return;
    if (!data) return;

    const type = data.type;
    if (type === "answer" || type === "restart_ice") {
      const sdp = typeof data.sdp === "string" ? data.sdp : undefined;
      if (!sdp) return;
      const signalingState = this.peer.signalingState;
      if (signalingState !== undefined && signalingState !== "have-local-offer") {
        console.warn(
          `[uurc] 忽略状态不匹配的 SOAC ${type}（signalingState=${signalingState}）→ 重协商未接上，画面可能停滞`,
        );
        this.recordDebugEvent("signal", "忽略状态不匹配的 SOAC answer", {
          type,
          signalingState,
          appControlId: readStringField(data, "app_control_id", "appControlId"),
          iceId: readStringField(data, "ice_id", "iceId"),
          sdpLength: sdp.length,
        });
        return;
      }
      try {
        await this.peer.setRemoteDescription({ type: "answer", sdp });
      } catch (error) {
        this.recordDebugEvent("signal", "应用 SOAC answer 失败", {
          type,
          error: error instanceof Error ? error.message : String(error),
          signalingState: this.peer.signalingState,
          appControlId: readStringField(data, "app_control_id", "appControlId"),
          iceId: readStringField(data, "ice_id", "iceId"),
          sdpLength: sdp.length,
        });
        return;
      }
      this.recordDebugEvent("signal", type === "restart_ice" ? "应用 restart_ice answer" : "应用 answer", {
        type,
        appControlId: readStringField(data, "app_control_id", "appControlId"),
        iceId: readStringField(data, "ice_id", "iceId"),
        sdpLength: sdp.length,
      });
      this.setState({
        ...this.state,
        stage: "connected",
      });
      await this.flushQueuedCandidates();
      return;
    }

    if (type === "candidate") {
      const candidate = normalizeCandidate(data.candidate);
      if (!candidate) return;
      if (this.peer.remoteDescription) {
        await this.peer.addIceCandidate(candidate);
        this.recordDebugEvent("signal", "应用远端 candidate", {
          iceId: readStringField(data, "ice_id", "iceId"),
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          candidateType: candidate.candidate ? extractCandidateType(candidate.candidate) : undefined,
        });
      } else {
        this.queuedCandidates.push(candidate);
        this.recordDebugEvent("signal", "缓存远端 candidate", {
          iceId: readStringField(data, "ice_id", "iceId"),
          queuedCandidates: this.queuedCandidates.length,
          candidateType: candidate.candidate ? extractCandidateType(candidate.candidate) : undefined,
        });
      }
      return;
    }
  }

  private isCurrentSoacPayload(
    record: Record<string, unknown> | null,
    data: Record<string, unknown> | null,
  ): boolean {
    return (
      matchesScopedString(readStringField(record, "client_id", "clientId"), this.clientId) &&
      matchesScopedString(readStringField(data, "app_control_id", "appControlId"), this.appControlId) &&
      matchesScopedString(readStringField(data, "ice_id", "iceId"), this.iceId)
    );
  }

  private async createAndSendLocalOffer(type: "offer" | "restart_ice" = "offer", options?: RTCOfferOptions): Promise<void> {
    if (!this.peer) return;
    const offer = await this.peer.createOffer(options);
    await this.peer.setLocalDescription(offer);
    await this.options.api.sendSignalSoac({
      type,
      clientId: this.clientId,
      iceId: this.iceId,
      appControlId: this.appControlId,
      sdp: offer.sdp,
      gzipSdp: this.gzipSdp,
      iceNetworkType: this.iceNetworkType,
    });
  }

  private async applySwitchNetworkNotify(payload: unknown): Promise<void> {
    if (!this.peer) return;
    const notify = normalizeSwitchNetworkNotify(payload, this.iceId);
    if (!notify) return;

    if (notify.transportType !== undefined) {
      this.iceNetworkType = notify.transportType;
    }
    console.warn(
      `[uurc] 收到切网通知 → 发起 ICE restart（transportType=${notify.transportType ?? "?"}），画面可能短暂停滞`,
    );
    this.peer.restartIce?.();
    this.recordDebugEvent("signal", "发起 ICE restart", {
      iceId: notify.iceId ?? this.iceId,
      transportType: notify.transportType,
    });
    await this.createAndSendLocalOffer("restart_ice", { iceRestart: true });
  }

  private async flushQueuedCandidates(): Promise<void> {
    if (!this.peer || !this.peer.remoteDescription) return;
    const candidates = this.queuedCandidates;
    this.queuedCandidates = [];
    for (const candidate of candidates) {
      await this.peer.addIceCandidate(candidate);
      this.recordDebugEvent("signal", "应用缓存 candidate", {
        candidateType: candidate.candidate ? extractCandidateType(candidate.candidate) : undefined,
      });
    }
  }

  private applyRemoteTrack(event: RTCTrackEvent): void {
    const stream = this.remoteStream ?? createMediaStream() ?? event.streams[0];
    if (!stream) return;
    const tracks = typeof stream.getTracks === "function" ? stream.getTracks() : [];
    const existingTrack = tracks.some((track) => track.id && track.id === event.track.id);
    if (!existingTrack && typeof stream.addTrack === "function") {
      stream.addTrack(event.track);
    }
    this.remoteStream = stream;
    const nextTrackCount = typeof stream.getTracks === "function" ? stream.getTracks().length : this.state.remoteTrackCount + (existingTrack ? 0 : 1);
    this.setState({
      ...this.state,
      remoteTrackCount: nextTrackCount,
    });
    this.options.onRemoteStream?.(stream);
    this.recordDebugEvent("session", "收到远端媒体轨道", {
      trackId: event.track.id,
      trackKind: event.track.kind,
      remoteTrackCount: nextTrackCount,
    });
  }

  private startEchoHeartbeat(): void {
    if (this.echoHeartbeatTimer !== undefined) return;
    this.recordDebugEvent("data_channel", "启动控制心跳", {
      label: STREAMER_DATA_CHANNEL_LABELS.control,
      intervalMs: BrowserRemoteSession.echoHeartbeatIntervalMs,
    });
    this.sendEchoHeartbeat();
    this.echoHeartbeatTimer = setInterval(() => {
      this.sendEchoHeartbeat();
    }, BrowserRemoteSession.echoHeartbeatIntervalMs);
  }

  private stopEchoHeartbeat(): void {
    if (this.echoHeartbeatTimer !== undefined) {
      clearInterval(this.echoHeartbeatTimer);
      this.echoHeartbeatTimer = undefined;
    }
    this.lastEchoHeartbeatDebugAtMs = 0;
  }

  private sendEchoHeartbeat(): void {
    const label = STREAMER_DATA_CHANNEL_LABELS.control;
    const channel = this.dataChannels.get(label);
    if (!channel || channel.readyState !== "open") {
      this.stopEchoHeartbeat();
      return;
    }

    const sequence = this.sequence;
    const now = this.now();
    const payload = encodeStreamerEchoRequestMessage({
      sequence,
      timestampMs: this.streamerTimestampSeconds(),
    });
    this.sequence += 1;

    try {
      channel.send(payload);
    } catch (error) {
      this.recordDebugEvent("data_send", "控制心跳发送失败", {
        label,
        sequence,
        readyState: channel.readyState,
        error: getErrorMessage(error),
      });
      // 仅在通道确实不可用时停止心跳。瞬时背压（send 抛错但通道仍 open）不应永久杀死心跳，
      // 否则受控端会因连续收不到心跳而判定主控离线并停止推流，只能断开重连才恢复。
      if (channel.readyState !== "open") {
        this.stopEchoHeartbeat();
      }
      return;
    }

    if (
      this.lastEchoHeartbeatDebugAtMs === 0 ||
      now - this.lastEchoHeartbeatDebugAtMs >= BrowserRemoteSession.echoHeartbeatDebugIntervalMs
    ) {
      this.recordDebugEvent("data_send", "发送控制心跳", {
        label,
        byteLength: payload.byteLength,
        sequence,
        intervalMs: BrowserRemoteSession.echoHeartbeatIntervalMs,
      });
      this.lastEchoHeartbeatDebugAtMs = now || 1;
    }
  }

  private recordDataChannelMessage(label: StreamerDataChannelLabel, data: unknown): void {
    const decodedControlMessage =
      label === STREAMER_DATA_CHANNEL_LABELS.control ? this.decodeControlDataChannelMessage(data) : undefined;
    if (decodedControlMessage) this.handleControlDataMessage(decodedControlMessage);

    const now = this.now();
    const lastDebugAtMs = this.lastDataReceiveDebugAtMs.get(label) ?? 0;
    if (lastDebugAtMs > 0 && now - lastDebugAtMs < BrowserRemoteSession.dataReceiveDebugIntervalMs) return;

    this.lastDataReceiveDebugAtMs.set(label, now || 1);
    this.recordDebugEvent("data_recv", `收到 ${label} 数据`, {
      label,
      ...summarizeDataChannelPayload(data),
      decoded: decodedControlMessage ? summarizeDecodedControlMessage(decodedControlMessage) : undefined,
    });
  }

  private decodeControlDataChannelMessage(data: unknown): DecodedStreamerControlMessage | undefined {
    const bytes = dataChannelPayloadBytes(data);
    if (!bytes) {
      // 桌面被控端在控制通道上推的是字符串(如剪贴板 JSON)，当前协议解析只认 protobuf；
      // 记录内容预览便于排查反向剪贴板等未接管的桌面消息。
      if (typeof data === "string" && data.length > 0) {
        this.recordDebugEvent("data_recv", "控制通道收到未解析的文本", {
          charLength: data.length,
          preview: data.length > 200 ? `${data.slice(0, 200)}...` : data,
        });
      }
      return undefined;
    }
    try {
      return decodeStreamerControlMessage(bytes);
    } catch (error) {
      this.recordDebugEvent("data_recv", "控制数据解码失败", {
        error: getErrorMessage(error),
        ...summarizeDataChannelPayload(data),
      });
      return undefined;
    }
  }

  private handleControlDataMessage(message: DecodedStreamerControlMessage): void {
    this.applyCaptureChangeInputIndex(message);
    this.applyRemoteClipboard(message);

    const simpleAction = message.simpleAction;
    if (!simpleAction || simpleAction.action !== STREAMER_SIMPLE_ACTION_TYPES.ACTION_TYPE_ECHO_REQUEST) return;
    const responseSequence = simpleAction.seq ?? message.sequence;
    if (responseSequence === undefined) {
      this.recordDebugEvent("data_recv", "收到控制 EchoRequest 但缺少 seq", summarizeDecodedControlMessage(message));
      return;
    }

    this.sendEchoResponse(responseSequence);
  }

  private applyRemoteClipboard(message: DecodedStreamerControlMessage): void {
    // 被控端的剪贴板（autoClipboard）以 sendToRom + RomMsg_Text 文本回传，与我们发送文本的结构对称。
    const rom = message.sendToRom;
    if (!rom || rom.inputType !== STREAMER_ROM_MESSAGE_TYPES.RomMsg_Text || !rom.inputMessage) return;
    this.recordDebugEvent("data_recv", "收到远端剪贴板", { length: rom.inputMessage.length });
    this.options.onRemoteClipboard?.(rom.inputMessage);
  }

  private applyCaptureChangeInputIndex(message: DecodedStreamerControlMessage): void {
    const captureChange = message.captureChange;
    if (!captureChange) return;

    const nextInputDisplayId =
      captureChange.captureTypeName === "CT_MUMU" && captureChange.captureId !== undefined
        ? captureChange.captureId
        : undefined;
    if (nextInputDisplayId === this.remoteInputDisplayId) return;

    this.remoteInputDisplayId = nextInputDisplayId;
    this.setState({
      ...this.state,
      remoteInputDisplayId: nextInputDisplayId,
    });
    this.recordDebugEvent("data_recv", "更新控制输入索引", {
      inputDisplayId: nextInputDisplayId,
      captureChange,
    });
  }

  private sendEchoResponse(responseSequence: number): void {
    const label = STREAMER_DATA_CHANNEL_LABELS.control;
    const channel = this.dataChannels.get(label);
    if (!channel || channel.readyState !== "open") return;

    const sequence = this.sequence;
    const timestampSeconds = this.streamerTimestampSeconds();
    const payload = encodeStreamerEchoResponseMessage({
      sequence,
      timestampMs: timestampSeconds,
      responseSequence,
    });
    this.sequence += 1;

    this.sendDataChannel(label, payload, {
      summary: "回复控制 EchoRequest",
      details: {
        sequence,
        timestampSeconds,
        responseSequence,
      },
    });
  }

  private sendDataChannel(
    label: StreamerDataChannelLabel,
    payload: string | Uint8Array,
    event:
      | {
          summary: string;
          details?: Record<string, unknown>;
        }
      | undefined = undefined,
  ): void {
    const channel = this.dataChannels.get(label);
    if (!channel) throw new Error(`${label} has not been created`);
    if (channel.readyState !== "open") throw new Error(`${label} is ${channel.readyState}, not open`);
    channel.send(payload);
    this.recordDebugEvent("data_send", event?.summary ?? `发送 ${label}`, {
      label,
      byteLength: dataChannelPayloadByteLength(payload),
      frameType: typeof payload === "string" ? "text" : "binary",
      ...(event?.details ?? {}),
    });
    this.updateDataChannelState(label);
  }

  private sendInputData(inputMessage: string): void {
    if (!inputMessage) {
      this.recordDebugEvent("data_send", "跳过空控制输入", {
        targetPlatform: this.targetPlatform,
      });
      return;
    }
    const sequence = this.sequence;
    const timestampSeconds = this.streamerTimestampSeconds();
    const inputDisplayId = this.resolveInputDisplayId();
    const payload = isDesktopPlatform(this.targetPlatform)
      ? inputMessage
      : encodeStreamerInputMessage({
          sequence,
          timestampMs: timestampSeconds,
          inputMessage,
          displayId: inputDisplayId,
        });
    this.sequence += 1;
    this.sendDataChannel(STREAMER_DATA_CHANNEL_LABELS.control, payload, {
      summary: "发送控制输入",
      details: {
        sequence,
        timestampSeconds,
        inputDisplayId,
        remoteDisplayId: this.remoteDisplayId,
        route: isDesktopPlatform(this.targetPlatform) ? "control_text" : "send_to_rom",
        targetPlatform: this.targetPlatform,
        input: summarizeInputMessage(inputMessage),
      },
    });
  }

  private resolveInputDisplayId(): number | undefined {
    if (this.remoteInputDisplayId !== undefined) return this.remoteInputDisplayId;
    return this.remoteDisplayId;
  }

  private buildMouseMoveAbsoluteInput(input: BrowserRemoteMousePositionInput): string {
    // 桌面被控端(Mac/Windows)都用归一化坐标(abs_x/abs_y ∈ [0,1])；移动端用像素。
    if (isDesktopPlatform(this.targetPlatform)) {
      return buildStreamerMacMouseMoveAbsoluteInputMessage({
        ...input,
        surfaceWidth: input.surfaceWidth ?? Math.max(1, Math.round(input.absX)),
        surfaceHeight: input.surfaceHeight ?? Math.max(1, Math.round(input.absY)),
      });
    }
    return buildStreamerMouseMoveAbsoluteInputMessage(input);
  }

  private buildKeyboardInput(input: BrowserRemoteKeyboardInput): string {
    if (isMacPlatform(this.targetPlatform)) {
      return buildStreamerMacKeyboardInputMessage(input);
    }
    if (isWindowsPlatform(this.targetPlatform)) {
      return buildStreamerWindowsKeyboardInputMessage(input);
    }
    return buildStreamerKeyboardInputMessage(input);
  }

  private updateDataChannelState(label: StreamerDataChannelLabel): void {
    const channel = this.dataChannels.get(label);
    const nextReadyState = channel?.readyState ?? "closed";
    // 仅在通道状态真正变化时推送，避免每次发送（鼠标移动/心跳/输入）都触发整页重渲染。
    if (this.state.dataChannels[label] === nextReadyState) return;
    this.setState({
      ...this.state,
      dataChannels: {
        ...this.state.dataChannels,
        [label]: nextReadyState,
      },
    });
  }

  private getDataChannelStates(): Partial<Record<StreamerDataChannelLabel, RTCDataChannelState>> {
    const states: Partial<Record<StreamerDataChannelLabel, RTCDataChannelState>> = {};
    for (const [label, channel] of this.dataChannels) {
      states[label] = channel.readyState;
    }
    return states;
  }

  private setState(state: BrowserRemoteSessionState): void {
    this.state = {
      ...state,
      debugEvents: this.debugEvents,
    };
    this.options.onStateChange?.(this.getState());
  }

  private recordDebugEvent(
    kind: BrowserRemoteDebugEventKind,
    summary: string,
    details?: Record<string, unknown>,
  ): void {
    const event: BrowserRemoteDebugEvent = {
      id: this.debugEventId++,
      atMs: this.now(),
      kind,
      summary,
      details: details === undefined ? undefined : dropUndefinedFields(details),
    };
    this.debugEvents = [...this.debugEvents, event].slice(-BrowserRemoteSession.maxDebugEvents);
    this.state = {
      ...this.state,
      debugEvents: this.debugEvents,
    };
    // 注意：调试事件只追加到环形缓冲，不主动推送 React 状态。
    // 高频路径（鼠标移动、控制心跳、回复 EchoRequest、收数据、统计采样）会产生大量调试事件，
    // 若每条都触发 onStateChange 会引发整页重渲染，挤占主线程，进而拖慢/饿死 100ms 控制心跳，
    // 导致受控端判定主控离线而停止推流（“发起控制后画面卡死”）。
    // 真正影响 UI 的状态变化都会经由 setState 单独推送；调试列表会在下一次 setState 或 1.5s 轮询时刷新。
  }

  private applyRemoteDisplayCapability(event: RemoteSignalGatewayEvent): void {
    const displayId = extractRemoteDisplayId(event.payload);
    if (displayId === undefined || displayId === this.remoteDisplayId) return;
    this.remoteDisplayId = displayId;
    this.setState({
      ...this.state,
      remoteDisplayId: displayId,
    });
    this.recordDebugEvent("signal", "记录受控端显示器", { displayId });
  }
}

function diagnoseVideoFlow(input: {
  nowMs: number;
  previous:
    | {
        inboundVideo?: BrowserRemoteInboundVideoStats;
        sampledAtMs: number;
        selectedCandidatePair?: BrowserRemoteSelectedCandidatePair;
      }
    | undefined;
  current: {
    inboundVideo?: BrowserRemoteInboundVideoStats;
    sampledAtMs: number;
    selectedCandidatePair?: BrowserRemoteSelectedCandidatePair;
  };
  previousVideoElement?: BrowserRemoteVideoElementSample;
  currentVideoElement?: BrowserRemoteVideoElementSample;
}): BrowserRemoteVideoFlowDiagnostics {
  const delta: BrowserRemoteVideoFlowDelta = {
    packetsReceived: diffNumber(input.previous?.inboundVideo?.packetsReceived, input.current.inboundVideo?.packetsReceived),
    bytesReceived: diffNumber(input.previous?.inboundVideo?.bytesReceived, input.current.inboundVideo?.bytesReceived),
    framesDecoded: diffNumber(input.previous?.inboundVideo?.framesDecoded, input.current.inboundVideo?.framesDecoded),
    framesReceived: diffNumber(input.previous?.inboundVideo?.framesReceived, input.current.inboundVideo?.framesReceived),
    framesDropped: diffNumber(input.previous?.inboundVideo?.framesDropped, input.current.inboundVideo?.framesDropped),
    keyFramesDecoded: diffNumber(input.previous?.inboundVideo?.keyFramesDecoded, input.current.inboundVideo?.keyFramesDecoded),
    pliCount: diffNumber(input.previous?.inboundVideo?.pliCount, input.current.inboundVideo?.pliCount),
    nackCount: diffNumber(input.previous?.inboundVideo?.nackCount, input.current.inboundVideo?.nackCount),
    firCount: diffNumber(input.previous?.inboundVideo?.firCount, input.current.inboundVideo?.firCount),
    freezeCount: diffNumber(input.previous?.inboundVideo?.freezeCount, input.current.inboundVideo?.freezeCount),
    sampleIntervalMs: diffNumber(input.previous?.inboundVideo?.timestampMs, input.current.inboundVideo?.timestampMs) ??
      diffNumber(input.previous?.sampledAtMs, input.current.sampledAtMs),
    candidateBytesReceived: diffNumber(
      input.previous?.selectedCandidatePair?.bytesReceived,
      input.current.selectedCandidatePair?.bytesReceived,
    ),
    candidateBytesSent: diffNumber(
      input.previous?.selectedCandidatePair?.bytesSent,
      input.current.selectedCandidatePair?.bytesSent,
    ),
    ...diffVideoElementSample(input.previousVideoElement, input.currentVideoElement),
  };
  const cleanDelta = dropUndefinedFields(delta) as BrowserRemoteVideoFlowDelta;

  if (!input.current.inboundVideo) {
    return {
      status: "waiting",
      title: "等待视频 RTP",
      detail: "浏览器尚未从 getStats 看到 inbound-rtp/video。",
      delta: cleanDelta,
      updatedAtMs: input.nowMs,
    };
  }

  if (!input.previous?.inboundVideo) {
    return {
      status: "receiving",
      title: "视频 RTP 已开始采样",
      detail: "已看到 inbound-rtp/video，下一次采样会给出增量。",
      delta: cleanDelta,
      updatedAtMs: input.nowMs,
    };
  }

  const frameDelta = positive(delta.framesDecoded) || positive(delta.framesReceived) || positive(delta.videoElementFrames);
  if (frameDelta) {
    return {
      status: "receiving",
      title: "画面帧在增长",
      detail: formatVideoFlowDelta(cleanDelta),
      delta: cleanDelta,
      updatedAtMs: input.nowMs,
    };
  }

  const rtpDelta = positive(delta.packetsReceived) || positive(delta.bytesReceived) || positive(delta.candidateBytesReceived);
  if (rtpDelta) {
    return {
      status: "decode_stalled",
      title: "RTP 仍在收包，解码帧未增长",
      detail: formatVideoFlowDelta(cleanDelta),
      delta: cleanDelta,
      updatedAtMs: input.nowMs,
    };
  }

  return {
    status: "transport_stalled",
    title: "RTP 收包无增量",
    detail: formatVideoFlowDelta(cleanDelta),
    delta: cleanDelta,
    updatedAtMs: input.nowMs,
  };
}

function diffVideoElementSample(
  previous: BrowserRemoteVideoElementSample | undefined,
  current: BrowserRemoteVideoElementSample | undefined,
): Pick<BrowserRemoteVideoFlowDelta, "videoElementFrames" | "videoElementTimeMs"> {
  if (!previous || !current) return {};
  return {
    videoElementFrames: diffNumber(previous.totalVideoFrames, current.totalVideoFrames),
    videoElementTimeMs: diffNumber(previous.currentTimeMs, current.currentTimeMs),
  };
}

function isActiveVideoElementSample(sample: BrowserRemoteVideoElementSample | undefined): boolean {
  if (!sample) return false;
  return (
    positive(sample.width) ||
    positive(sample.height) ||
    positive(sample.totalVideoFrames) ||
    positive(sample.currentTimeMs) ||
    (sample.readyState !== undefined && sample.readyState >= 2)
  );
}

function diffNumber(previous: number | undefined, current: number | undefined): number | undefined {
  if (previous === undefined || current === undefined) return undefined;
  return current - previous;
}

function positive(value: number | undefined): boolean {
  return value !== undefined && value > 0;
}

function formatVideoFlowDelta(delta: BrowserRemoteVideoFlowDelta): string {
  return [
    delta.framesDecoded === undefined ? null : `decoded +${delta.framesDecoded}`,
    delta.framesReceived === undefined ? null : `received +${delta.framesReceived}`,
    delta.keyFramesDecoded === undefined || delta.keyFramesDecoded === 0 ? null : `key +${delta.keyFramesDecoded}`,
    delta.framesDropped === undefined || delta.framesDropped === 0 ? null : `dropped +${delta.framesDropped}`,
    delta.packetsReceived === undefined ? null : `pkt +${delta.packetsReceived}`,
    delta.bytesReceived === undefined ? null : `bytes +${delta.bytesReceived}`,
    delta.pliCount === undefined || delta.pliCount === 0 ? null : `pli +${delta.pliCount}`,
    delta.nackCount === undefined || delta.nackCount === 0 ? null : `nack +${delta.nackCount}`,
    delta.firCount === undefined || delta.firCount === 0 ? null : `fir +${delta.firCount}`,
    delta.freezeCount === undefined || delta.freezeCount === 0 ? null : `freeze +${delta.freezeCount}`,
    delta.sampleIntervalMs === undefined ? null : `interval ${Math.round(delta.sampleIntervalMs)}ms`,
    delta.videoElementFrames === undefined ? null : `video +${delta.videoElementFrames}`,
  ]
    .filter(Boolean)
    .join(" · ") || "本次采样没有可比较增量";
}

function summarizeInputMessage(inputMessage: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(inputMessage);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      return dropUndefinedFields({
        action: record.action,
        button: record.button,
        key: record.key,
        abs_x: record.abs_x,
        abs_y: record.abs_y,
        absX: record.absX,
        absY: record.absY,
        delta_x: record.delta_x,
        delta_y: record.delta_y,
        deltaX: record.deltaX,
        deltaY: record.deltaY,
      });
    }
  } catch {
    // Some input messages are plain strings such as TEXT_CONTROL or MuMu touch commands.
  }
  return {
    preview: inputMessage.length > 80 ? `${inputMessage.slice(0, 80)}...` : inputMessage,
    length: inputMessage.length,
  };
}

function summarizeSignalEvent(event: RemoteSignalGatewayEvent): Record<string, unknown> {
  return dropUndefinedFields({
    id: event.id,
    event: event.event,
    payload: summarizeSignalPayload(event.payload),
  });
}

function summarizeSignalPayload(payload: unknown): unknown {
  const payloads = Array.isArray(payload) ? payload : [payload];
  return payloads.map((item) => {
    const record = asRecord(item);
    const data = asRecord(record?.data);
    if (!record && !data) return typeof item === "string" ? item.slice(0, 120) : item;
    return dropUndefinedFields({
      client_id: readStringField(record, "client_id", "clientId"),
      type: readStringField(data, "type"),
      app_control_id: readStringField(data, "app_control_id", "appControlId"),
      ice_id: readStringField(data, "ice_id", "iceId"),
      hasSdp: typeof data?.sdp === "string" && data.sdp.length > 0,
      hasGzipSdp: data?.gzip_sdp !== undefined,
      candidateType: extractCandidateType(asRecord(data?.candidate)?.candidate),
    });
  });
}

function extractRemoteDisplayId(payload: unknown): number | undefined {
  const payloads = Array.isArray(payload) ? payload : [payload];
  for (const item of payloads) {
    const record = asRecord(item);
    const data = asRecord(record?.data) ?? record;
    const capability = asRecord(data?.device_capability);
    const displayInfo = capability?.display_info;
    if (!Array.isArray(displayInfo)) continue;
    for (const display of displayInfo) {
      const displayRecord = asRecord(display);
      const id = displayRecord ? numberValue(displayRecord.id) : undefined;
      if (id !== undefined) return id;
    }
  }
  return undefined;
}

function extractCandidateType(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") return undefined;
  const match = candidate.match(/\btyp\s+([a-zA-Z0-9_-]+)/);
  return match?.[1];
}

function dropUndefinedFields<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

function normalizeCandidate(value: unknown): RTCIceCandidateInit | null {
  const record = asRecord(value);
  if (!record || typeof record.candidate !== "string" || record.candidate.length === 0) return null;
  const candidate: RTCIceCandidateInit = {
    candidate: record.candidate,
  };
  if (typeof record.sdpMid === "string") candidate.sdpMid = record.sdpMid;
  if (typeof record.sdpMLineIndex === "number") candidate.sdpMLineIndex = record.sdpMLineIndex;
  return candidate;
}

function normalizeSwitchNetworkNotify(payload: unknown, currentIceId: string | undefined): SwitchNetworkNotify | null {
  const payloads = Array.isArray(payload) ? payload : [payload];
  for (const item of payloads) {
    const record = asRecord(item);
    if (!record) continue;
    const iceId = typeof record.ice_id === "string" ? record.ice_id : undefined;
    if (iceId && currentIceId && iceId !== currentIceId) continue;
    const transportType = typeof record.transport_type === "number" ? (record.transport_type as StreamerIceNetworkType) : undefined;
    return { iceId, transportType };
  }
  return null;
}

function matchesScopedString(value: string | undefined, currentValue: string | undefined): boolean {
  return value === undefined || currentValue === undefined || value === currentValue;
}

function readStringField(record: Record<string, unknown> | null, ...keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function createMediaStream(): MediaStream | null {
  return typeof MediaStream === "undefined" ? null : new MediaStream();
}

function getBrowserH264CodecPreferences(): RTCRtpCodec[] {
  if (typeof RTCRtpSender === "undefined" || typeof RTCRtpSender.getCapabilities !== "function") return [];
  const codecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
  const h264Codecs = codecs.filter((codec) => codec.mimeType.toLowerCase() === "video/h264");
  if (h264Codecs.length === 0) return [];
  const rtxCodecs = codecs.filter((codec) => codec.mimeType.toLowerCase() === "video/rtx");
  return [...h264Codecs, ...rtxCodecs];
}

function applyVideoCodecPreferences(transceiver: RTCRtpTransceiver, codecs: RTCRtpCodec[]): void {
  if (codecs.length === 0 || typeof transceiver.setCodecPreferences !== "function") return;
  try {
    transceiver.setCodecPreferences(codecs);
  } catch {
    // Codec preferences are advisory; keep offer creation usable if the browser rejects the filtered list.
  }
}

function readSelectedCandidatePair(report: BrowserRemoteStatsReport): {
  connectionPath: StreamerConnectionPath;
  pair?: BrowserRemoteSelectedCandidatePair;
} {
  const entries = new Map<string, Record<string, unknown>>();
  report.forEach((value, key) => {
    const record = asRecord(value);
    if (record) entries.set(key, record);
  });

  const pairRecord = [...entries.values()].find(isSelectedCandidatePair);
  if (!pairRecord) return { connectionPath: "unknown" };

  const local = entries.get(stringValue(pairRecord.localCandidateId)) ?? {};
  const remote = entries.get(stringValue(pairRecord.remoteCandidateId)) ?? {};
  const pair: BrowserRemoteSelectedCandidatePair = {};
  assignString(pair, "localCandidateType", local.candidateType ?? pairRecord.localCandidateType);
  assignString(pair, "remoteCandidateType", remote.candidateType ?? pairRecord.remoteCandidateType);
  assignString(pair, "localAddress", local.address ?? local.ip ?? local.ipAddress);
  assignString(pair, "remoteAddress", remote.address ?? remote.ip ?? remote.ipAddress);
  assignString(pair, "protocol", local.protocol ?? pairRecord.protocol);
  assignOptionalNumber(pair, "bytesReceived", pairRecord.bytesReceived);
  assignOptionalNumber(pair, "bytesSent", pairRecord.bytesSent);
  assignOptionalNumber(pair, "currentRoundTripTime", pairRecord.currentRoundTripTime);
  assignOptionalNumber(pair, "availableIncomingBitrate", pairRecord.availableIncomingBitrate);
  assignOptionalNumber(pair, "availableOutgoingBitrate", pairRecord.availableOutgoingBitrate);

  const candidateType =
    pair.localCandidateType === "relay" || pair.remoteCandidateType === "relay"
      ? "relay"
      : pair.localCandidateType ?? pair.remoteCandidateType;
  return {
    connectionPath: classifyStreamerConnectionPath({
      candidateType,
      isLanConnection: isPrivateHostCandidatePair(pair),
    }),
    pair,
  };
}

function readInboundVideoStats(report: BrowserRemoteStatsReport): BrowserRemoteInboundVideoStats | undefined {
  const entries = new Map<string, Record<string, unknown>>();
  const records: Record<string, unknown>[] = [];
  report.forEach((value, key) => {
    const record = asRecord(value);
    if (record) entries.set(key, record);
    if (record && record.type === "inbound-rtp" && (record.kind === "video" || record.mediaType === "video")) {
      records.push(record);
    }
  });
  const record = records.sort((left, right) => numberValue(right.framesDecoded) - numberValue(left.framesDecoded))[0];
  if (!record) return undefined;

  const stats: BrowserRemoteInboundVideoStats = {};
  assignString(stats, "codecId", record.codecId);
  assignOptionalNumber(stats, "packetsReceived", record.packetsReceived);
  assignOptionalNumber(stats, "packetsLost", record.packetsLost);
  assignOptionalNumber(stats, "bytesReceived", record.bytesReceived);
  assignOptionalNumber(stats, "framesDecoded", record.framesDecoded);
  assignOptionalNumber(stats, "framesReceived", record.framesReceived);
  assignOptionalNumber(stats, "framesDropped", record.framesDropped);
  assignOptionalNumber(stats, "keyFramesDecoded", record.keyFramesDecoded);
  assignOptionalNumber(stats, "freezeCount", record.freezeCount);
  assignOptionalNumber(stats, "totalFreezesDuration", record.totalFreezesDuration);
  assignOptionalNumber(stats, "pauseCount", record.pauseCount);
  assignOptionalNumber(stats, "totalPausesDuration", record.totalPausesDuration);
  assignOptionalNumber(stats, "jitterBufferDelay", record.jitterBufferDelay);
  assignOptionalNumber(stats, "jitterBufferEmittedCount", record.jitterBufferEmittedCount);
  assignOptionalNumber(stats, "nackCount", record.nackCount);
  assignOptionalNumber(stats, "pliCount", record.pliCount);
  assignOptionalNumber(stats, "firCount", record.firCount);
  assignOptionalNumber(stats, "frameWidth", record.frameWidth);
  assignOptionalNumber(stats, "frameHeight", record.frameHeight);
  assignOptionalNumber(stats, "framesPerSecond", record.framesPerSecond);
  assignOptionalNumber(stats, "framesAssembledFromMultiplePackets", record.framesAssembledFromMultiplePackets);
  assignOptionalNumber(stats, "totalAssemblyTime", record.totalAssemblyTime);
  assignOptionalNumber(stats, "timestampMs", record.timestamp);
  assignString(stats, "decoderImplementation", record.decoderImplementation);
  assignBoolean(stats, "powerEfficientDecoder", record.powerEfficientDecoder);

  const codec = entries.get(stringValue(record.codecId));
  if (codec) {
    assignString(stats, "codecMimeType", codec.mimeType);
    assignOptionalNumber(stats, "codecPayloadType", codec.payloadType);
  }
  return Object.keys(stats).length > 0 ? stats : undefined;
}

function isSelectedCandidatePair(record: Record<string, unknown>): boolean {
  if (record.type !== "candidate-pair") return false;
  if (record.selected === true) return true;
  if (record.nominated === true && record.state === "succeeded") return true;
  return record.state === "succeeded" && typeof record.localCandidateId === "string";
}

function isPrivateHostCandidatePair(pair: BrowserRemoteSelectedCandidatePair): boolean {
  return (
    pair.localCandidateType === "host" &&
    pair.remoteCandidateType === "host" &&
    isPrivateAddress(pair.localAddress) &&
    isPrivateAddress(pair.remoteAddress)
  );
}

function isPrivateAddress(value: string | undefined): boolean {
  if (!value) return false;
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1, 3).map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dataChannelPayloadByteLength(data: string | ArrayBufferView | ArrayBuffer): number {
  if (typeof data === "string") return new TextEncoder().encode(data).byteLength;
  return data.byteLength;
}

function summarizeDataChannelPayload(data: unknown): Record<string, unknown> {
  const bytes = dataChannelPayloadBytes(data);
  if (typeof data === "string") {
    return {
      payloadType: "string",
      charLength: data.length,
    };
  }
  if (data instanceof ArrayBuffer) {
    return {
      payloadType: "arraybuffer",
      byteLength: data.byteLength,
      hexPrefix: bytesToHexPrefix(bytes),
    };
  }
  if (ArrayBuffer.isView(data)) {
    return {
      payloadType: data.constructor.name,
      byteLength: data.byteLength,
      hexPrefix: bytesToHexPrefix(bytes),
    };
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return {
      payloadType: "blob",
      byteLength: data.size,
    };
  }
  return {
    payloadType: typeof data,
  };
}

function summarizeDecodedControlMessage(message: DecodedStreamerControlMessage): Record<string, unknown> {
  return dropUndefinedFields({
    sequence: message.sequence,
    timestampMs: message.timestampMs,
    topLevelTags: message.topLevelTags,
    simpleAction: message.simpleAction
      ? dropUndefinedFields({
          action: message.simpleAction.action,
          actionName: message.simpleAction.actionName,
          args: message.simpleAction.args,
          seq: message.simpleAction.seq,
          featureFlags: message.simpleAction.featureFlags,
        })
      : undefined,
    captureChange: message.captureChange,
    sendToRom: message.sendToRom
      ? dropUndefinedFields({
          inputType: message.sendToRom.inputType,
          inputTypeName: message.sendToRom.inputTypeName,
          displayId: message.sendToRom.displayId,
          input: message.sendToRom.inputMessage ? summarizeInputMessage(message.sendToRom.inputMessage) : undefined,
        })
      : undefined,
  });
}

function dataChannelPayloadBytes(data: unknown): Uint8Array | undefined {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return undefined;
}

function bytesToHexPrefix(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return undefined;
  return Array.from(bytes.slice(0, 32))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function isMacPlatform(platform: number | undefined): boolean {
  return platform === 4;
}

function isWindowsPlatform(platform: number | undefined): boolean {
  return platform === 1;
}

// 桌面被控端(Mac/Windows)输入走「裸 JSON + 归一化坐标」；移动端(安卓/MuMu)走「protobuf + 像素」。
function isDesktopPlatform(platform: number | undefined): boolean {
  return isMacPlatform(platform) || isWindowsPlatform(platform);
}

function assignString<T extends object, K extends keyof T>(target: T, key: K, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    target[key] = value as T[K];
  }
}

function assignBoolean<T extends object, K extends keyof T>(target: T, key: K, value: unknown): void {
  if (typeof value === "boolean") {
    target[key] = value as T[K];
  }
}

function assignOptionalNumber<T extends object, K extends keyof T>(target: T, key: K, value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value as T[K];
  }
}
