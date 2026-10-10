import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STREAMER_CONTROL_CONNECT_TYPES,
  analyzeRemoteSignalReadiness,
  buildDefaultStreamerConnectOptionsBase64,
} from "@uurc/shared/streamerProtocol";
import App from "../src/App.js";
import type { BrowserRemoteSessionState } from "../src/remote/browserRemoteSession.js";
import { getRemoteConnectionQuality } from "../src/remote/remoteControlUiModel.js";

const readLocalClipboardTextMock = vi.hoisted(() => vi.fn(async () => ""));

vi.mock("../src/browser/clipboard.js", () => ({
  readLocalClipboardText: readLocalClipboardTextMock,
}));

const authReady = {
  hasState: true,
  missingFields: [],
  userId: "user-1",
  clientId: "client-1",
  deviceId: "web-device-1",
  channel: "official",
};

const authMissing = {
  hasState: false,
  missingFields: ["token", "userId", "deviceId"],
};

let currentAuthStatus: typeof authReady | typeof authMissing = authReady;
let requestLog: Array<{ method: string; path: string; body: unknown; transportPath?: string }> = [];
let currentRemoteSignalEvents: unknown[] = [];
let joinRoomFailure: boolean;
let lastControlIceId: string;
let currentControlForceRelay: boolean;
let currentParticipants: Array<Record<string, unknown>>;
let currentAssistControlMode: string;
let currentSignalServers: string[];
let signalStartError: boolean;
let remoteTrackPlan: Array<{ id: string; kind: "audio" | "video" }>;

describe("App console", () => {
  beforeEach(() => {
    currentAuthStatus = authReady;
    requestLog = [];
    joinRoomFailure = false;
    lastControlIceId = "";
    currentControlForceRelay = false;
    currentAssistControlMode = "by_password";
    currentSignalServers = ["wss://signal.example"];
    signalStartError = false;
    remoteTrackPlan = [];
    currentParticipants = [
      {
        client_id: "client-phone-1",
        device_id: "phone-1",
        alias: "iPhone",
        platform: 3,
        user_join_type: 1,
        controlled_time: 180,
        app_flag: { control_mode: "second_screen" },
      },
      {
        client_id: "client-mac-1",
        device_id: "mac-1",
        alias: "Studio Mac",
        platform: 4,
        user_join_type: 1,
        controlled_time: 180,
        app_flag: { control_mode: null },
      },
    ];
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "inbound",
        event: "soac",
        receivedAt: "2026-05-14T00:00:00.200Z",
        payload: [
          {
            client_id: "controlled-1",
            data: {
              type: "answer",
              sdp: "v=0 answer",
            },
          },
        ],
      },
    ];
    TestPeerConnection.lastConfiguration = null;
    TestPeerConnection.sentByLabel = {};
    TestPeerConnection.channels = {};
    TestPeerConnection.closed = false;
    TestPeerConnection.statsReports = [];
    readLocalClipboardTextMock.mockReset();
    readLocalClipboardTextMock.mockResolvedValue("");
    window.localStorage.clear();
    // 默认关闭“自动连接”，让现有用例显式走手动连接流程；单独的用例会显式打开它。
    window.localStorage.setItem("uurc.autoConnect", "false");
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    seedLoginState(authReady);
    vi.stubGlobal("fetch", vi.fn(handleFetch));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("supports the app-aligned mobile login flow and local state export", async () => {
    currentAuthStatus = authMissing;
    window.localStorage.removeItem("uurc.loginState");
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("未登录");
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByLabelText("用手机号登录")).toBeInTheDocument();
    expect(screen.getByText("导入登录态")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "远控画面" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的设备" })).not.toBeInTheDocument();
    expect(screen.queryByText("Android 刷新")).not.toBeInTheDocument();
    expect(screen.queryByText("本地缓存")).not.toBeInTheDocument();
    expect(screen.queryByText(/ADB/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建网页设备" })).not.toBeInTheDocument();

    expect(screen.getByLabelText("区号")).toHaveValue("86");
    await user.type(screen.getByLabelText("手机号"), "13800000000");
    await user.click(screen.getByRole("button", { name: "获取验证码" }));
    await screen.findByText("验证码已发送");

    await user.type(screen.getByLabelText("短信验证码"), "123456");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getAllByText("已登录").length).toBeGreaterThan(0);
    });
    await screen.findByRole("heading", { name: "我的设备" });
    expect(window.location.pathname).toBe("/devices");
    expect(screen.getAllByText("user-1").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "导出登录态" }));
    await waitFor(() => {
      expect((screen.getByLabelText("登录态 JSON") as HTMLTextAreaElement).value).toContain('"token": "header.payload.signature"');
    });
  });

  it("uses a consumer remote-control flow: login page, device list, then focused control page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    await screen.findByRole("button", { name: /Office Mac/ });
    expect(screen.queryByRole("heading", { name: "远控画面" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出登录态" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /连接 Office Mac/ }));

    await screen.findByRole("heading", { name: "Office Mac" });
    expect(window.location.pathname).toBe("/devices/desktop-1/control");
    expect(screen.getByRole("application", { name: "远控画面" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的设备" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的账号" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回设备列表" })).toBeInTheDocument();
    expect(screen.getByText("控制设置")).toBeInTheDocument();
    expect(screen.getByText("调试信息")).toBeInTheDocument();
  });

  it("auto-connects on entering a device when auto-connect is enabled", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    window.localStorage.setItem("uurc.autoConnect", "true");
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    await user.click(await screen.findByRole("button", { name: /连接 Office Mac/ }));
    await screen.findByRole("heading", { name: "Office Mac" });

    // 自动发起连接：无需手动点“开始连接”，信令网关 start 请求应自动出现。
    await waitFor(() => {
      expect(requestLog.some((call) => call.path === "/api/remote/signal/start")).toBe(true);
    });
  });

  it("starts a partner remote-assistance session by device ID and code", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    expect(screen.getByLabelText("伙伴设备系统")).toHaveValue("1");
    await user.type(screen.getByLabelText("伙伴的设备 ID"), "982123456");
    await user.type(screen.getByLabelText("伙伴的设备验证码"), "L6026CCD");
    await user.click(screen.getByRole("button", { name: /^连接$/ }));

    await screen.findByRole("heading", { name: "Partner PC" });
    expect(window.location.pathname).toBe("/devices/982123456/control");
    expect(uuCalls("/api/v2/room/share/control_mode")).toHaveLength(1);
    expect(uuCalls("/api/v2/room/join/share/by_code")).toHaveLength(1);
    expect(screen.getAllByText("远程协助 · 验证码").length).toBeGreaterThan(0);

    await startCompatibleConnection(user);

    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/start")).toHaveLength(1);
    });
    const startCall = requestLog.find((call) => call.path === "/api/remote/signal/start");
    expect(startCall?.body).toHaveProperty("roomConfig.token", "assist-room-token");
    expect(startCall?.body).toHaveProperty("joinContext.kind", "remote_assistance");
    expect(startCall?.body).toHaveProperty("joinContext.connectId", "982123456");
    expect(startCall?.body).toHaveProperty("joinContext.targetPlatform", 1);

    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    const controlCall = requestLog.find((call) => call.path === "/api/remote/signal/control");
    expect(controlCall?.body).toMatchObject({
      appDataBase64: buildDefaultStreamerConnectOptionsBase64({
        deviceId: "web-device-1",
        controlConnectType: STREAMER_CONTROL_CONNECT_TYPES.ControlConnectType_Assistance,
      }),
    });

    await user.click(screen.getByRole("button", { name: "断开连接" }));

    await waitFor(() => {
      expect(requestLog.some((call) => call.method === "DELETE" && call.path === "/api/remote/signal")).toBe(true);
    });
    await waitFor(() => {
      expect(uuCalls("/api/v2/room/share/cancel_remote_assist")).toHaveLength(1);
    });
    expect(screen.getAllByText("已取消协助").length).toBeGreaterThan(0);
  });

  it("waits for partner confirmation when the verification code is left empty", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    currentAssistControlMode = "password_confirmation";
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    await user.type(screen.getByLabelText("伙伴的设备 ID"), "982123456");
    // 故意不填验证码：应直接走“等待对方确认”
    await user.click(screen.getByRole("button", { name: /^连接$/ }));

    await screen.findByRole("heading", { name: "Partner PC" });
    expect(window.location.pathname).toBe("/devices/982123456/control");
    expect(uuCalls("/api/v2/room/join/share/by_code")).toHaveLength(0);
    expect(uuCalls("/api/v2/room/join/share/by_confirmation")).toHaveLength(1);
    expect(screen.getAllByText("远程协助 · 验证码或确认").length).toBeGreaterThan(0);
  });

  it("preserves a control page deep link while restoring login state on refresh", async () => {
    window.history.replaceState(null, "", "/devices/desktop-1/control");

    render(<App />);

    await screen.findByRole("heading", { name: "Office Mac" });
    expect(window.location.pathname).toBe("/devices/desktop-1/control");
    expect(screen.getByRole("application", { name: "远控画面" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的设备" })).not.toBeInTheDocument();
  });

  it("defers room join until the operator starts the connection from the control page", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    await user.click(await screen.findByRole("button", { name: /连接 Office Mac/ }));
    await screen.findByRole("heading", { name: "Office Mac" });

    expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(0);
    await startCompatibleConnection(user);

    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/start")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
  });

  it("loads controllable devices and joins a selected room", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentRemoteSignalEvents = [
      ...currentRemoteSignalEvents,
      {
        id: 2,
        direction: "inbound",
        event: "soac:ack",
        receivedAt: "2026-05-14T00:00:00.250Z",
        payload: ["success", { code: 0 }],
      },
      {
        id: 3,
        direction: "inbound",
        event: "mystery_direct_event",
        receivedAt: "2026-05-14T00:00:00.300Z",
        payload: [{ opaque: true }],
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    expect(screen.getAllByText("已有控制端").length).toBeGreaterThan(0);
    expect(screen.getAllByText("iPhone").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Studio Mac").length).toBeGreaterThan(0);
    const iPhoneParticipant = screen.getByText("iPhone").closest(".participant-card");
    const macParticipant = screen.getByText("Studio Mac").closest(".participant-card");
    expect(iPhoneParticipant).not.toBeNull();
    expect(macParticipant).not.toBeNull();
    expect(within(iPhoneParticipant as HTMLElement).getByText(/iOS · 主控 · 3m/)).toBeInTheDocument();
    expect(within(iPhoneParticipant as HTMLElement).getByText(/模式：副屏/)).toBeInTheDocument();
    expect(within(macParticipant as HTMLElement).getByText(/macOS · 主控 · 3m/)).toBeInTheDocument();
    expect(within(macParticipant as HTMLElement).getByText(/模式：普通桌面/)).toBeInTheDocument();
    expect(screen.getByText("控制模式")).toBeInTheDocument();
    expect(screen.getAllByText("普通桌面").length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "普通加入" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "接管控制" })).not.toBeChecked();
    expect(screen.queryByText(/room-token-1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/report-token-1/)).not.toBeInTheDocument();
    expect(screen.getByText("连接服务")).toBeInTheDocument();
    expect(screen.queryByText(/X-NRD-AUTH=<redacted room token>/)).not.toBeInTheDocument();
    expect(screen.queryByText("soac, streamer_push, forward_setting, device_capability")).not.toBeInTheDocument();
    expect(screen.queryByText(/be-controlled, answer, candidate/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    expect(screen.getByRole("radio", { name: "自动路径" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "强制 UU 中转" }));
    expect(getPrimaryAction("开始连接")).toBeEnabled();
    expect(screen.queryByText("选择接管后重试")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/start")).toHaveLength(1);
    });
    expect(screen.getByText(/gzip_sdp":false/)).toBeInTheDocument();
    expect(screen.getByText(/X-NRD-AUTH=<redacted room token>/)).toBeInTheDocument();
    expect(screen.getByText("soac, streamer_push, forward_setting, device_capability")).toBeInTheDocument();
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();
    expect(TestPeerConnection.lastConfiguration).toMatchObject({ iceTransportPolicy: "relay" });
    expect(screen.getAllByText("强制中转").length).toBeGreaterThan(0);
    expect(screen.getByText("使用 ack ICE")).toBeInTheDocument();
    expect(screen.getByText("possible pkt=8 latency=90 / force pkt=18 latency=160")).toBeInTheDocument();
    expect(screen.getByText("mystery_direct_event")).toBeInTheDocument();
    expect(screen.getByText("入会方式")).toBeInTheDocument();
    expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    expect(screen.getByText("连接许可已确认")).toBeInTheDocument();
    expect(uuCalls("/api/v1/room/app_flag")).toHaveLength(0);
    expect(screen.queryByText("controlled-1")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requestLog.some((call) => call.path === "/api/remote/signal/events")).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getAllByText("UU 中转").length).toBeGreaterThan(0);
    });
    await user.click(screen.getByRole("button", { name: "手动断开连接" }));
    await waitFor(() => {
      expect(screen.getAllByText("已关闭").length).toBeGreaterThan(0);
    });
  });

  it("starts the remote view from the connection action without a second click", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);

    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/start")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();
  });

  it("starts the signal gateway from the first room signal entry", async () => {
    currentParticipants = [];
    currentSignalServers = ["wss://signal-a.example", "wss://signal-b.example"];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);

    await waitFor(() => {
      const startCalls = requestLog.filter((call) => call.path === "/api/remote/signal/start");
      expect(startCalls.at(-1)?.body).toMatchObject({ gzipSdp: false });
      expect(startCalls.at(-1)?.body).toHaveProperty("roomConfig.token", "room-token-1");
    });
    expect(screen.getByText("wss://signal-a.example")).toBeInTheDocument();
  });

  it("asks the operator to rejoin the room when the signal gateway rejects a stale RoomConfig", async () => {
    currentParticipants = [];
    signalStartError = true;
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);

    await screen.findByText("连接失败：websocket error");
    expect(getPrimaryAction("重新开始连接")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();
  });

  it("presents the console as an operator workflow instead of a protocol dump", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    expect(screen.getByRole("heading", { name: "设备" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /连接 Office Mac/ })).toBeInTheDocument();
    expect(screen.getByLabelText("账号管理")).toBeInTheDocument();
    expect(screen.queryByLabelText("远控主流程")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始连接" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "桌面端" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "移动端" })).toBeInTheDocument();
  });

  it("prioritizes the remote workspace over account administration", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });

    const panelHeadings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(panelHeadings.slice(0, 2)).toEqual(["设备", "账号管理"]);
    expect(await screen.findByRole("button", { name: /连接 Office Mac/ })).toBeInTheDocument();
    expect(screen.queryByRole("application", { name: "远控画面" })).not.toBeInTheDocument();
  });

  it("presents account operations as a controller identity workflow", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });

    expect(screen.getByRole("heading", { name: "账号管理" })).toBeInTheDocument();
    const identityStatus = screen.getByLabelText("账号状态");
    expect(within(identityStatus).getByText("身份")).toBeInTheDocument();
    expect(within(identityStatus).getByText("网页控制端")).toBeInTheDocument();
    expect(within(identityStatus).getByText("状态")).toBeInTheDocument();
    expect(within(identityStatus).getByText("本机控制端")).toBeInTheDocument();
    expect(screen.queryByText("导入登录态")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出登录态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
  });

  it("logs out from account management and returns to the login entry", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    expect(window.localStorage.getItem("uurc.loginState")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "退出登录" }));

    await screen.findByRole("heading", { name: "登录" });
    expect(window.localStorage.getItem("uurc.loginState")).toBeNull();
    expect(screen.getByText("导入登录态")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的设备" })).not.toBeInTheDocument();
  });

  it("shows the upstream room join blocker when the service refuses an occupied target", async () => {
    joinRoomFailure = true;
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user, { waitForReady: false });
    await user.click(getPrimaryAction("开始连接"));

    await waitFor(() => {
      expect(document.body.textContent).toContain("服务端拒绝加入房间");
    });
    // 占用者非本人时，提示合并到占用条：告知可点「接管并开始连接」强制接管。
    expect(document.body.textContent).toContain("接管并开始连接");
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();
  });

  it("blocks joining the current controller device as a remote target", async () => {
    currentAuthStatus = { ...authReady, deviceId: "desktop-1" };
    seedLoginState({ ...authReady, deviceId: "desktop-1" });
    render(<App />);

    await screen.findByRole("heading", { name: "我的设备" });
    expect(await screen.findByText("Office Mac")).toBeInTheDocument();
    expect(screen.getByText("本次登录设备")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /连接 Office Mac/ })).not.toBeInTheDocument();

    expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(0);
  });

  it("surfaces a productized remote readiness diagnosis when the controlled side leaves before answer", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "outbound",
        event: "control",
        receivedAt: "2026-05-14T00:00:00.000Z",
        payload: { app_control_id: "control-1" },
      },
      {
        id: 2,
        direction: "inbound",
        event: "control:ack",
        receivedAt: "2026-05-14T00:00:00.050Z",
        payload: ["success", { code: 0 }],
      },
      {
        id: 3,
        direction: "outbound",
        event: "soac",
        receivedAt: "2026-05-14T00:00:00.100Z",
        payload: { client_id: "controlled-1", data: { type: "offer", ice_id: "ice-1" } },
      },
      {
        id: 4,
        direction: "inbound",
        event: "leave",
        receivedAt: "2026-05-14T00:00:00.200Z",
        payload: [{ ice_id: "ice-1", "ntes-trace-id": "trace-server-kick-1" }],
      },
      {
        id: 5,
        direction: "inbound",
        event: "switch_network_notify",
        receivedAt: "2026-05-14T00:00:00.250Z",
        payload: [{ transport_type: 3, attempt_switch_type: 2, ice_id: "ice-1" }],
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    await screen.findByText("远控诊断");
    await screen.findByText("受控端离开，未收到 answer");
    await screen.findByText("服务端断开 · leave · trace-server-kick-1 · ice=matched");
    await screen.findByText("transport=3 · attempt=2 · ice=yes");
    expect(screen.getByText("连接确认已收到")).toBeInTheDocument();
    expect(screen.getByText("offer 已发送")).toBeInTheDocument();
    expect(requestLog.some((call) => call.path === "/api/remote/signal/diagnostics")).toBe(true);
  });

  it("labels missing answer as waiting for the controlled session", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "outbound",
        event: "control",
        receivedAt: "2026-05-14T00:00:00.000Z",
        payload: { app_control_id: "control-1" },
      },
      {
        id: 2,
        direction: "inbound",
        event: "control:ack",
        receivedAt: "2026-05-14T00:00:00.050Z",
        payload: ["success", { code: 0 }],
      },
      {
        id: 3,
        direction: "outbound",
        event: "soac",
        receivedAt: "2026-05-14T00:00:00.100Z",
        payload: { client_id: "controlled-1", data: { type: "offer", ice_id: "ice-1" } },
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("等待受控端 answer").length).toBeGreaterThan(0);
    });
    await screen.findByText("受控端回包未到达");
  });

  it("recommends explicit takeover when a normal join leaves before answer", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "outbound",
        event: "control",
        receivedAt: "2026-05-14T00:00:00.000Z",
        payload: { app_control_id: "control-1" },
      },
      {
        id: 2,
        direction: "inbound",
        event: "control:ack",
        receivedAt: "2026-05-14T00:00:00.050Z",
        payload: ["success", { code: 0 }],
      },
      {
        id: 3,
        direction: "outbound",
        event: "soac",
        receivedAt: "2026-05-14T00:00:00.100Z",
        payload: { client_id: "controlled-1", data: { type: "offer", ice_id: "ice-1" } },
      },
      {
        id: 4,
        direction: "inbound",
        event: "leave",
        receivedAt: "2026-05-14T00:00:00.200Z",
        payload: [{ ice_id: "ice-1" }],
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    await screen.findByText("answer 未返回");
    await screen.findByText("受控端回包未到达");
    await screen.findByText("画面未返回。");
    expect(screen.getByRole("radio", { name: "普通加入" })).toBeChecked();
  });

  it("surfaces a failed be-controlled ControlResult before waiting for answer", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "outbound",
        event: "control",
        receivedAt: "2026-05-14T00:00:00.000Z",
        payload: { app_control_id: "control-1" },
      },
      {
        id: 2,
        direction: "inbound",
        event: "control:ack",
        receivedAt: "2026-05-14T00:00:00.050Z",
        payload: ["success", { code: 0 }],
      },
      {
        id: 3,
        direction: "outbound",
        event: "soac",
        receivedAt: "2026-05-14T00:00:00.100Z",
        payload: { client_id: "controlled-1", data: { type: "offer", ice_id: "ice-1" } },
      },
      {
        id: 4,
        direction: "inbound",
        event: "be-controlled",
        receivedAt: "2026-05-14T00:00:00.150Z",
        payload: [{ code: 100001, msg: "occupied" }],
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    await screen.findByText("be-controlled 返回失败");
    await screen.findByText("code=100001 · protocol=protocol_error_2021 · msg=occupied");
    expect(screen.getByText("be-controlled 失败")).toBeInTheDocument();
    expect(screen.queryByText("等待受控端 SetRemoteOffer/answer")).not.toBeInTheDocument();
  });

  it("surfaces a failed control ack before sending an offer", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentRemoteSignalEvents = [
      {
        id: 1,
        direction: "outbound",
        event: "control",
        receivedAt: "2026-05-14T00:00:00.000Z",
        payload: { app_control_id: "control-1" },
      },
      {
        id: 2,
        direction: "inbound",
        event: "control:ack",
        receivedAt: "2026-05-14T00:00:00.050Z",
        payload: ["fail", { code: 100002, msg: "rejected" }],
      },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    await openAdvancedSettings(user);

    // 信令事件由后台自动轮询同步（已无手动同步入口），等待轮询应用 control:ack 失败事件。
    await screen.findByText(
      "ack=fail · code=100002 · protocol=protocol_error_2022 · msg=rejected",
      undefined,
      { timeout: 3000 },
    );
    expect(screen.getAllByText("连接确认失败").length).toBeGreaterThan(0);
  });

  it("respects service-requested relay while the operator keeps automatic routing", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentControlForceRelay = true;
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await user.click(screen.getByRole("radio", { name: "兼容模式" }));
    expect(screen.getByRole("radio", { name: "自动路径" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "接管控制" }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "接管控制" })).toBeChecked();
    });
    await user.click(getPrimaryAction("接管并开始连接"));
    await waitFor(() => {
      expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("接管加入").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    expect(TestPeerConnection.lastConfiguration).toMatchObject({ iceTransportPolicy: "all" });
    expect(screen.getByRole("radio", { name: "自动路径" })).toBeChecked();
    expect(screen.getAllByText("服务端要求中转").length).toBeGreaterThan(0);
  });

  it("auto-enables remote input control once the control channel opens", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    // 连接后默认进入控制状态：自动启用输入控制并聚焦画面，无需手动点一下。
    const controlSegment = await screen.findByRole("button", { name: "控制中" });
    expect(controlSegment).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).toHaveAttribute("aria-label", "远控画面");

    // 忠实按键:普通键在 keydown 即同步发「按下+抬起」一对(瞬时一击)，不在被控端留下“按住”状态。
    const controlSentBefore = TestPeerConnection.sentByLabel.CONTROL_DATA_CHANNEL?.length ?? 0;
    await user.keyboard("a");
    const controlSentAfter = TestPeerConnection.sentByLabel.CONTROL_DATA_CHANNEL?.length ?? 0;
    expect(controlSentAfter - controlSentBefore).toBeGreaterThanOrEqual(2);

    // 点“仅查看”暂停操作，开关切回仅查看态。
    await user.click(screen.getByRole("button", { name: "仅查看" }));
    expect(screen.getByRole("button", { name: "仅查看" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "控制中" })).toHaveAttribute("aria-pressed", "false");
  });

  it("surfaces one-click reconnect after the control channel drops and reuses the current room", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    await user.click(screen.getByRole("checkbox", { name: "自动重连" }));

    TestPeerConnection.closeDataChannel("CONTROL_DATA_CHANNEL");

    await screen.findByText("控制连接已断开");
    const reconnectButton = screen.getByRole("button", { name: "重新连接" });
    expect(reconnectButton).toBeEnabled();

    await user.click(reconnectButton);

    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(2);
    });
    expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
    expect(requestLog.filter((call) => call.path === "/api/remote/signal/start")).toHaveLength(1);
  });

  it("auto reconnects recoverable sessions without rejoining the UU room", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });

    TestPeerConnection.closeDataChannel("CONTROL_DATA_CHANNEL");

    await screen.findByText(/自动重连将在/);
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(2);
    }, { timeout: 2500 });
    expect(uuCalls("/api/v1/room/join/by_device/desktop-1")).toHaveLength(1);
  });

  it("surfaces clipboard sync, connection quality, and manual video source selection", async () => {
    vi.stubGlobal("MediaStream", FakeMediaStream);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    readLocalClipboardTextMock.mockResolvedValue("from clipboard");
    currentParticipants = [];
    remoteTrackPlan = [
      { id: "blank-video", kind: "video" },
      { id: "desktop-video", kind: "video" },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await screen.findByRole("button", { name: "控制中" });

    expect(screen.getByRole("region", { name: "连接质量" })).toBeInTheDocument();
    expect(screen.getByText("等待质量采样")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "自动重连" })).toBeChecked();

    expect(screen.getByRole("region", { name: "画面源" })).toBeInTheDocument();
    // 画面源按钮名称现含分辨率/信号标注（如“画面 1 无信号”），用前缀匹配定位。
    expect(screen.getByRole("button", { name: /^画面 1/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^画面 2/ }));
    expect(screen.getByRole("button", { name: /^画面 2/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "读取剪贴板" }));
    await waitFor(() => {
      expect(readLocalClipboardTextMock).toHaveBeenCalledTimes(1);
    });
    await screen.findByText("已读取 14 字符");
    const textBytesBefore = TestPeerConnection.sentByLabel.TEXT_DATA_CHANNEL?.length ?? 0;
    await user.click(screen.getByRole("button", { name: "发送到远端" }));
    expect(TestPeerConnection.sentByLabel.TEXT_DATA_CHANNEL?.length).toBeGreaterThan(textBytesBefore);
    expect(screen.getByText("已发送 14 字符到远端")).toBeInTheDocument();
  });

  it("shows useful connection quality metrics when WebRTC stats provide them", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const firstStatsReport = buildStatsReport({
      bytesReceived: 1_000_000,
      framesDecoded: 100,
      framesDropped: 2,
      framesPerSecond: 30,
      timestamp: 1_000,
    });
    const secondStatsReport = buildStatsReport({
      bytesReceived: 1_600_000,
      framesDecoded: 130,
      framesDropped: 3,
      framesPerSecond: 30,
      frameWidth: 1920,
      frameHeight: 1080,
      currentRoundTripTime: 0.042,
      timestamp: 2_000,
    });
    const thirdStatsReport = buildStatsReport({
      bytesReceived: 2_200_000,
      framesDecoded: 160,
      framesDropped: 3,
      framesPerSecond: 30,
      frameWidth: 1920,
      frameHeight: 1080,
      currentRoundTripTime: 0.042,
      timestamp: 3_000,
    });
    const fourthStatsReport = buildStatsReport({
      bytesReceived: 2_800_000,
      framesDecoded: 190,
      framesDropped: 3,
      framesPerSecond: 30,
      frameWidth: 1920,
      frameHeight: 1080,
      currentRoundTripTime: 0.042,
      timestamp: 4_000,
    });
    TestPeerConnection.statsReports = [firstStatsReport, secondStatsReport, thirdStatsReport, fourthStatsReport];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await openAdvancedSettings(user);

    // 连接质量由后台自动轮询刷新 WebRTC 统计，等待轮询消费至少两帧统计后算出码率/帧率。
    const quality = screen.getByRole("region", { name: "连接质量" });
    await within(quality).findByText("帧率", undefined, { timeout: 3000 });
    expect(within(quality).getByText("30 fps")).toBeInTheDocument();
    expect(within(quality).getByText("接收码率")).toBeInTheDocument();
    expect(within(quality).getByText("4.8 Mbps")).toBeInTheDocument();
    expect(within(quality).getByText("延迟")).toBeInTheDocument();
    expect(within(quality).getByText("42 ms")).toBeInTheDocument();
    expect(within(quality).getByText("分辨率")).toBeInTheDocument();
    expect(within(quality).getByText("1920x1080")).toBeInTheDocument();
  });

  it("keeps connection quality metric slots stable when WebRTC stats fluctuate", () => {
    const richState: BrowserRemoteSessionState = {
      appControlId: "app-1",
      connectionPath: "direct",
      dataChannels: {},
      debugEvents: [],
      remoteTrackCount: 1,
      stage: "connected",
      inboundVideo: {
        bytesReceived: 2_200_000,
        decoderImplementation: "VideoToolbox",
        frameHeight: 1440,
        frameWidth: 2560,
        framesDropped: 0,
        framesPerSecond: 57,
        freezeCount: 0,
        jitterBufferDelay: 0.012,
        jitterBufferEmittedCount: 6,
        packetsLost: 0,
        packetsReceived: 420,
      },
      selectedCandidatePair: {
        availableIncomingBitrate: 6_000_000,
        availableOutgoingBitrate: 300_000,
        currentRoundTripTime: 0.001,
      },
      videoFlow: {
        status: "receiving",
        title: "receiving",
        detail: "receiving",
        delta: {
          bytesReceived: 97_200,
          framesDecoded: 57,
          sampleIntervalMs: 1000,
        },
        updatedAtMs: 1_000,
      },
    };
    const sparseState: BrowserRemoteSessionState = {
      appControlId: "app-1",
      connectionPath: "direct",
      dataChannels: {},
      debugEvents: [],
      remoteTrackCount: 1,
      stage: "connected",
      videoFlow: {
        status: "receiving",
        title: "receiving",
        detail: "receiving",
        updatedAtMs: 2_000,
      },
    };
    const expectedLabels = [
      "路径",
      "画面",
      "输入",
      "控制通道",
      "文本通道",
      "帧率",
      "接收码率",
      "延迟",
      "分辨率",
      "丢帧",
      "冻结",
      "丢包",
      "抖动缓冲",
      "下行余量",
      "上行余量",
      "解码器",
    ];

    const richMetrics = getRemoteConnectionQuality({
      state: richState,
      controlChannelState: "open",
      inputControlActive: false,
      textChannelState: "open",
      connectionPathLabel: "直连",
    }).metrics;
    const sparseMetrics = getRemoteConnectionQuality({
      state: sparseState,
      controlChannelState: "open",
      inputControlActive: false,
      textChannelState: "open",
      connectionPathLabel: "直连",
    }).metrics;

    expect(richMetrics.map((metric) => metric.label)).toEqual(expectedLabels);
    expect(sparseMetrics.map((metric) => metric.label)).toEqual(expectedLabels);
    expect(metricValue(sparseMetrics, "输入")).toBe("仅查看");
    expect(metricValue(sparseMetrics, "接收码率")).toBe("采样中");
    expect(metricValue(sparseMetrics, "分辨率")).toBe("暂无");
  });

  it("separates input lock state from the open control data channel", () => {
    const state: BrowserRemoteSessionState = {
      appControlId: "app-1",
      connectionPath: "relay",
      dataChannels: {},
      debugEvents: [],
      remoteTrackCount: 1,
      stage: "connected",
      videoFlow: {
        status: "receiving",
        title: "receiving",
        detail: "receiving",
        updatedAtMs: 1_000,
      },
    };

    const quality = getRemoteConnectionQuality({
      state,
      controlChannelState: "open",
      inputControlActive: false,
      textChannelState: "open",
      connectionPathLabel: "UU 中转",
    });

    // 输入状态（仅查看）与控制数据通道状态（已打开）分别展示，互不混淆。
    expect(metricValue(quality.metrics, "输入")).toBe("仅查看");
    expect(metricValue(quality.metrics, "控制通道")).toBe("已打开");
    expect(metricValue(quality.metrics, "文本通道")).toBe("已打开");
  });

  it("docks the toolbar by default and only floats/drags it in fullscreen, with view mode and shortcuts", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    await screen.findByRole("button", { name: "控制中" });

    const stage = screen.getByRole("application", { name: "远控画面" }) as HTMLDivElement;
    // 全屏对包含命令栏的容器（.control-stage-frame，即 stage 的父元素）请求；
    // 用 mock 模拟浏览器进入全屏：设置 fullscreenElement 并派发 fullscreenchange。
    const stageFrame = stage.parentElement as HTMLDivElement;
    const requestFullscreen = vi.fn(async () => {
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: stageFrame });
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    stageFrame.requestFullscreen = requestFullscreen;
    const toolbar = screen.getByLabelText("远控主流程");

    // 非全屏：工具栏固定在原位——没有拖动手柄，也没有 fixed 浮动定位。
    expect(screen.queryByRole("button", { name: "拖动工具栏" })).not.toBeInTheDocument();
    expect(toolbar.style.position).toBe("");

    expect(stage).toHaveClass("remote-stage-fit");
    await user.click(screen.getByRole("button", { name: "填充画面" }));
    expect(stage).toHaveClass("remote-stage-fill");
    await user.click(screen.getByRole("button", { name: "适应画面" }));
    expect(stage).toHaveClass("remote-stage-fit");

    // 进入全屏后才出现拖动手柄，并可把工具栏悬浮拖到画面内任意位置。
    await user.click(screen.getByRole("button", { name: "全屏" }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    const dragHandle = await screen.findByRole("button", { name: "拖动工具栏" });
    vi.spyOn(toolbar.parentElement as HTMLElement, "getBoundingClientRect").mockReturnValue(
      rectFrom({ left: 0, top: 0, width: 900, height: 500 }),
    );
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(
      rectFrom({ left: 300, top: 20, width: 420, height: 52 }),
    );
    fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 320, clientY: 40 });
    fireEvent.pointerMove(dragHandle, { pointerId: 1, clientX: 430, clientY: 110 });
    fireEvent.pointerUp(dragHandle, { pointerId: 1, clientX: 430, clientY: 110 });
    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "410px", top: "90px", transform: "none" });
    });

    const sentBefore = TestPeerConnection.sentByLabel.CONTROL_DATA_CHANNEL?.length ?? 0;
    await user.click(screen.getByText("快捷键"));
    await user.click(screen.getByRole("button", { name: "Ctrl Alt Del" }));
    expect(TestPeerConnection.sentByLabel.CONTROL_DATA_CHANNEL?.length).toBeGreaterThan(sentBefore);
    expect(screen.getByRole("button", { name: "Cmd Opt Esc" })).toBeInTheDocument();

    // 清理：退出全屏，避免 fullscreenElement 残留影响后续用例。
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    document.dispatchEvent(new Event("fullscreenchange"));
  });

  it("shows a first-class disconnect action that closes the browser remote session", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await screen.findByRole("button", { name: "断开连接" });

    await user.click(screen.getByRole("button", { name: "断开连接" }));

    await waitFor(() => {
      expect(requestLog.some((call) => call.method === "DELETE" && call.path === "/api/remote/signal")).toBe(true);
    });
    const deleteCallIndex = requestLog.findIndex((call) => call.method === "DELETE" && call.path === "/api/remote/signal");
    await waitFor(() => {
      expect(requestLog.slice(deleteCallIndex + 1).some((call) => call.method === "GET" && call.path === "/api/v1/device/groups/of/my")).toBe(true);
    });
    expect(TestPeerConnection.closed).toBe(true);
    expect(screen.getAllByText("已关闭").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已释放房间").length).toBeGreaterThan(0);
  });

  it("disconnects the active remote session before returning to the device list", async () => {
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });

    await user.click(screen.getByRole("button", { name: "返回设备列表" }));

    await screen.findByRole("heading", { name: "我的设备" });
    expect(window.location.pathname).toBe("/devices");
    await waitFor(() => {
      expect(requestLog.some((call) => call.method === "DELETE" && call.path === "/api/remote/signal")).toBe(true);
    });
    expect(TestPeerConnection.closed).toBe(true);
    expect(screen.queryByRole("heading", { name: "Office Mac" })).not.toBeInTheDocument();
  });

  it("keeps extra incoming video tracks out of the main remote-control surface", async () => {
    vi.stubGlobal("MediaStream", FakeMediaStream);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.stubGlobal("RTCPeerConnection", TestPeerConnection);
    currentParticipants = [];
    remoteTrackPlan = [
      { id: "blank-video", kind: "video" },
      { id: "desktop-video", kind: "video" },
      { id: "remote-audio", kind: "audio" },
    ];
    const user = userEvent.setup();
    render(<App />);

    await openOfficeMacControl(user);
    await startCompatibleConnection(user);
    await waitFor(() => {
      expectSignalState("已连接");
    });
    await waitFor(() => {
      expect(requestLog.filter((call) => call.path === "/api/remote/signal/control")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "打开远控画面" })).not.toBeInTheDocument();

    await screen.findByLabelText("远控画面视频");
    expect(screen.queryByLabelText("远控视频 2")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "画面源" })).toBeInTheDocument();
  });
});

async function openOfficeMacControl(
  user: ReturnType<typeof userEvent.setup>,
  options: { waitForReady?: boolean } = {},
): Promise<void> {
  await screen.findByRole("heading", { name: "我的设备" });
  await user.click(await screen.findByRole("button", { name: /连接 Office Mac/ }));
  await screen.findByRole("heading", { name: "Office Mac" });
  if (options.waitForReady === true) {
    await screen.findByText("已就绪");
  }
}

function expectSignalState(expected: string): void {
  const signalStateLabel = screen.getByText("信令状态");
  expect(signalStateLabel.closest(".status-row")).toHaveTextContent(expected);
}

function getPrimaryAction(name: string): HTMLElement {
  return within(screen.getByLabelText("远控主流程")).getByRole("button", { name });
}

async function startCompatibleConnection(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("radio", { name: "兼容模式" }));
  await user.click(getPrimaryAction("开始连接"));
}

async function openAdvancedSettings(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const advanced = screen.getByText("调试信息");
  const details = advanced.closest("details");
  if (!details?.hasAttribute("open")) {
    await user.click(advanced);
  }
}

async function handleFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const path = String(input);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;

  if (path === "/api/proxy/uu" && method === "POST") {
    return handleUuProxyFetch(body);
  }

  requestLog.push({ method, path, body });

  if (path === "/api/runtime") {
    return jsonResponse({
      ok: true,
      runtime: "node",
      uuProxyPath: "/api/proxy/uu",
      signalGateway: "node-socket-io",
      remoteApiBase: "/api/remote",
      wispProxy: true,
    });
  }

  if (path === "/api/remote/signal/start" && method === "POST") {
    const joinContext = body.joinContext as { kind?: string; deviceId?: string } | undefined;
    const remoteAssistance = joinContext?.kind === "remote_assistance";
    expect(body).toMatchObject({ gzipSdp: false });
    expect(body).toHaveProperty("roomConfig.token", remoteAssistance ? "assist-room-token" : "room-token-1");
    expect(body).toHaveProperty("joinContext.deviceId", remoteAssistance ? "982123456" : "desktop-1");
    if (signalStartError) {
      return jsonResponse({
        status: "error",
        strategy: "backend_signal_gateway",
        selectedSignalServer: currentSignalServers[0],
        signalServers: currentSignalServers,
        signalHeaders: {
          "X-NRD-AUTH": "<redacted room token>",
          "X-NRD-CONTROLLING": "0",
          streamer_version: "V3.1.14",
          streamer_flag: "{\"sdp_flags\":{\"gzip_sdp\":false}}",
        },
        signalControl: {
          socketEvents: {
            control: "control",
            leave: "leave",
            bmsgPush: "bmsg_push",
            publisherDisconnect: "publisher_disconnect",
          },
          event: "control",
          payloadKeys: ["app_control_id", "app_data", "streamer_data"],
          ackTimeoutMs: 10000,
        },
        connectionId: "web-test-signal-1",
        startedAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z",
        error: "websocket error",
      });
    }
    const signalServerIndex = typeof body.signalServerIndex === "number" ? body.signalServerIndex : 0;
    return jsonResponse({
      status: "connected",
      strategy: "backend_signal_gateway",
      selectedSignalServer: currentSignalServers[signalServerIndex] ?? currentSignalServers[0],
      signalServers: currentSignalServers,
      signalHeaders: {
        "X-NRD-AUTH": "<redacted room token>",
        "X-NRD-CONTROLLING": "0",
        streamer_version: "V3.1.14",
        streamer_flag: "{\"sdp_flags\":{\"gzip_sdp\":false}}",
      },
      signalControl: {
        socketEvents: {
          control: "control",
          leave: "leave",
          bmsgPush: "bmsg_push",
          publisherDisconnect: "publisher_disconnect",
        },
        event: "control",
        payloadKeys: ["app_control_id", "app_data", "streamer_data"],
        ackTimeoutMs: 10000,
      },
      connectionId: "web-test-signal-1",
      startedAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    });
  }

  if (path === "/api/remote/signal/control" && method === "POST") {
    expect(body.appControlId).toEqual(expect.any(String));
    expect(body.appDataBase64).toEqual(expect.any(String));
    expect(body.streamerData).toContain('"control_id"');
    const streamerData = JSON.parse(body.streamerData);
    expect(streamerData.device_capability.display_info[0]).toMatchObject({
      fps: 60,
      type: 0,
      hdr: -1,
    });
    expect(streamerData.device_capability.video_codec_capability[0]).toMatchObject({
      video_codec: 1,
      width: 3840,
      height: 2160,
    });
    expect(streamerData.device_capability.ice_id).toBe("");
    lastControlIceId = "control-ice-1";
    return jsonResponse({
      event: "control",
      ackStatus: "success",
      ack: [],
      control: {
        ackStatus: "success",
        result: {
          clientId: "controlled-1",
          iceId: lastControlIceId,
          forceRelay: currentControlForceRelay,
          autoSwitchNetwork: true,
          forceAutoSwitchPacketLoss: 18,
          forceAutoSwitchLatency: 160,
          possibleAutoSwitchPacketLoss: 8,
          possibleAutoSwitchLatency: 90,
          iceServers: [
            {
              urls: "stun:stun.example:3478",
            },
          ],
        },
      },
      emittedAt: "2026-05-14T00:00:00.000Z",
      ackReceivedAt: "2026-05-14T00:00:00.050Z",
    });
  }

  if (path === "/api/remote/signal/soac" && method === "POST") {
    expect(body).toMatchObject({
      type: "offer",
      clientId: "controlled-1",
      iceId: lastControlIceId,
      sdp: "v=0 browser offer",
      gzipSdp: false,
      iceNetworkType: 3,
    });
    expect(body.appControlId).toEqual(expect.any(String));
    return jsonResponse({
      event: "soac",
      payload: body,
      emittedAt: "2026-05-14T00:00:00.100Z",
    });
  }

  if (path === "/api/remote/signal/events") {
    return jsonResponse(currentRemoteSignalEvents);
  }

  if (path === "/api/remote/signal/diagnostics") {
    return jsonResponse(
      analyzeRemoteSignalReadiness({
        events: currentRemoteSignalEvents,
        signalStatus: {
          status: "connected",
          strategy: "backend_signal_gateway",
          selectedSignalServer: "wss://signal.example",
          signalServers: ["wss://signal.example"],
          signalHeaders: {
            "X-NRD-AUTH": "<redacted room token>",
          },
          signalControl: {
            socketEvents: {
              control: "control",
              leave: "leave",
              bmsgPush: "bmsg_push",
              publisherDisconnect: "publisher_disconnect",
            },
            event: "control",
            payloadKeys: ["app_control_id", "app_data", "streamer_data"],
            ackTimeoutMs: 10000,
          },
          connectionId: "web-test-signal-1",
          startedAt: "2026-05-14T00:00:00.000Z",
          updatedAt: "2026-05-14T00:00:00.000Z",
        },
      }),
    );
  }

  if (path === "/api/remote/signal" && method === "DELETE") {
    return jsonResponse({
      status: "closed",
      strategy: "backend_signal_gateway",
      selectedSignalServer: "wss://signal.example",
      signalServers: ["wss://signal.example"],
      signalHeaders: {
        "X-NRD-AUTH": "<redacted room token>",
      },
      signalControl: {
        socketEvents: {
          control: "control",
          leave: "leave",
          bmsgPush: "bmsg_push",
          publisherDisconnect: "publisher_disconnect",
        },
        event: "control",
        payloadKeys: ["app_control_id", "app_data", "streamer_data"],
        ackTimeoutMs: 10000,
      },
      startedAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:01.000Z",
      roomClear: {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        body: {
          code: 0,
          msg: "ok",
        },
      },
    });
  }

  throw new Error(`Unhandled fetch ${method} ${path}`);
}

async function handleUuProxyFetch(body: unknown): Promise<Response> {
  const request = body as { method: string; path: string; body?: unknown; headers?: Record<string, string> };
  requestLog.push({
    method: request.method,
    path: request.path,
    body: request.body ?? null,
    transportPath: "/api/proxy/uu",
  });
  expect(request.headers?.["X-Param-SIGN"]).toEqual(expect.any(String));

  if (request.path === "/api/v1/device/android/init" && request.method === "POST") {
    expect(request.body).toMatchObject({ client_id: expect.stringMatching(/^uurc-web-/), model: "Pixel 8" });
    return jsonResponse(uuResponse({ code: 0, data: { device_id: "web-device-1" } }));
  }

  if (request.path === "/api/v1/security/mobile/code" && request.method === "POST") {
    expect(request.body).toEqual({ country_code: "86", mobile: "13800000000", type: "login" });
    return jsonResponse(uuResponse({ code: 0, data: { ok: true } }));
  }

  if (request.path === "/api/v1/login/by_mobile" && request.method === "POST") {
    expect(request.body).toEqual({ country_code: "86", mobile: "13800000000", code: "123456" });
    currentAuthStatus = authReady;
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        user_id: "user-1",
        nickname: "Local User",
        token: "header.payload.signature",
      },
    }));
  }

  if (request.path === "/api/v1/device/groups/of/my" && request.method === "GET") {
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        desktop_devices: [
          {
            device_id: "desktop-1",
            alias: "Office Mac",
            controllable: true,
            status: "CONNECTED",
            app_flag: { control_mode: null },
            participants_info: currentParticipants,
          },
        ],
        mobile_devices: [],
        tv_devices: [],
      },
    }));
  }

  if (request.path === "/api/v1/room/join/by_device/desktop-1" && request.method === "POST") {
    expect(request.body).toMatchObject({ force_join: expect.any(Boolean) });
    if (joinRoomFailure) {
      return jsonResponse(uuResponse({
        code: 2002,
        msg: "被控端正在被远控中，无法发起连接",
      }, 400));
    }
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        room_config: {
          token: "room-token-1",
          signal_servers: currentSignalServers,
          timeout: 12000,
          signal_reconnect_delay: 1500,
          report_token: "report-token-1",
          app_data: "{}",
        },
      },
    }));
  }

  if (request.path === "/api/v1/room/clear/by_device/desktop-1" && request.method === "POST") {
    return jsonResponse(uuResponse({ code: 0, msg: "ok" }));
  }

  if (request.path === "/api/v2/room/share/control_mode" && request.method === "POST") {
    expect(request.body).toEqual({ connect_id: "982123456" });
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        can_remote_control: true,
        control_mode: currentAssistControlMode,
      },
    }));
  }

  if (request.path === "/api/v2/room/join/share/by_code" && request.method === "POST") {
    expect(request.body).toEqual({ connect_id: "982123456", connect_code: "L6026CCD" });
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        control_id: "assist-control-1",
        device_name: "Partner PC",
        platform: 1,
        room_config: {
          token: "assist-room-token",
          signaling_server: "wss://assist-primary.example",
          signaling_list: ["wss://assist-primary.example"],
          ws_connect_timeout_ms: 12000,
          streamer_retry_delta_ms: 900,
          report_token: "assist-report-token",
          report_url: "https://report.example/qos",
        },
      },
    }));
  }

  if (request.path === "/api/v2/room/join/share/by_confirmation" && request.method === "POST") {
    expect(request.body).toMatchObject({ connect_id: "982123456" });
    return jsonResponse(uuResponse({
      code: 0,
      data: {
        control_id: "assist-control-1",
        device_name: "Partner PC",
        platform: 1,
        room_config: {
          token: "assist-room-token",
          signaling_server: "wss://assist-primary.example",
          ws_connect_timeout_ms: 12000,
          streamer_retry_delta_ms: 900,
        },
      },
    }));
  }

  if (request.path === "/api/v2/room/share/cancel_remote_assist" && request.method === "POST") {
    expect(request.body).toEqual({ connect_id: "982123456" });
    return jsonResponse(uuResponse({ code: 0, msg: "ok" }));
  }

  if (request.path === "/api/v1/room/app_flag" && request.method === "POST") {
    expect(request.body).toEqual({
      publisher_device_id: "desktop-1",
      app_flag: { control_mode: null },
    });
    return jsonResponse(uuResponse({ code: 0 }));
  }

  throw new Error(`Unhandled UU proxy ${request.method} ${request.path}`);
}

function uuResponse(body: unknown, status = 200) {
  return {
    status,
    statusText: status === 200 ? "OK" : "Bad Request",
    headers: { "content-type": "application/json" },
    body,
  };
}

function uuCalls(path: string) {
  return requestLog.filter((call) => call.path === path && call.transportPath === "/api/proxy/uu");
}

function metricValue(metrics: Array<{ label: string; value: string }>, label: string): string {
  return metrics.find((metric) => metric.label === label)?.value ?? "";
}

function seedLoginState(status: typeof authReady): void {
  window.localStorage.setItem(
    "uurc.loginState",
    JSON.stringify({
      token: "header.payload.signature",
      userId: status.userId,
      clientId: status.clientId,
      deviceId: status.deviceId,
      channel: status.channel,
    }),
  );
}

function rectFrom(input: { left: number; top: number; width: number; height: number }): DOMRect {
  return {
    ...input,
    x: input.left,
    y: input.top,
    right: input.left + input.width,
    bottom: input.top + input.height,
    toJSON: () => input,
  } as DOMRect;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildStatsReport(input: {
  bytesReceived?: number;
  framesDecoded?: number;
  framesDropped?: number;
  framesPerSecond?: number;
  frameWidth?: number;
  frameHeight?: number;
  currentRoundTripTime?: number;
  timestamp?: number;
}): Map<string, Record<string, unknown>> {
  return new Map<string, Record<string, unknown>>([
    [
      "pair-1",
      {
        id: "pair-1",
        type: "candidate-pair",
        selected: true,
        state: "succeeded",
        localCandidateId: "local-1",
        remoteCandidateId: "remote-1",
        currentRoundTripTime: input.currentRoundTripTime,
      },
    ],
    ["local-1", { id: "local-1", type: "local-candidate", candidateType: "relay", protocol: "udp", address: "203.0.113.10" }],
    ["remote-1", { id: "remote-1", type: "remote-candidate", candidateType: "relay", address: "203.0.113.11" }],
    [
      "codec-1",
      {
        id: "codec-1",
        type: "codec",
        mimeType: "video/H264",
      },
    ],
    [
      "inbound-video-1",
      {
        id: "inbound-video-1",
        type: "inbound-rtp",
        kind: "video",
        codecId: "codec-1",
        bytesReceived: input.bytesReceived,
        framesDecoded: input.framesDecoded,
        framesDropped: input.framesDropped,
        framesPerSecond: input.framesPerSecond,
        frameWidth: input.frameWidth,
        frameHeight: input.frameHeight,
        timestamp: input.timestamp,
      },
    ],
  ]);
}

class TestPeerConnection {
  static lastConfiguration: RTCConfiguration | null = null;
  static sentByLabel: Record<string, number[]> = {};
  static channels: Record<string, RTCDataChannel> = {};
  static closed = false;
  static statsReports: Array<Map<string, Record<string, unknown>>> = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;

  constructor(configuration?: RTCConfiguration) {
    TestPeerConnection.lastConfiguration = configuration ?? null;
  }

  createDataChannel(label: string): RTCDataChannel {
    const channel = {
      label,
      readyState: "open",
      binaryType: "arraybuffer",
      onopen: null,
      onclose: null,
      onerror: null,
      send: (data: string | Blob | ArrayBuffer | ArrayBufferView) => {
        const bytes = data instanceof ArrayBuffer
          ? data.byteLength
          : ArrayBuffer.isView(data)
            ? data.byteLength
            : typeof data === "string"
              ? data.length
              : 0;
        TestPeerConnection.sentByLabel[label] = [...(TestPeerConnection.sentByLabel[label] ?? []), bytes];
      },
      close: () => {},
    } as unknown as RTCDataChannel;
    TestPeerConnection.channels[label] = channel;
    return channel;
  }

  addTransceiver(_kind: "audio" | "video", _init?: RTCRtpTransceiverInit): RTCRtpTransceiver {
    return {} as RTCRtpTransceiver;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "v=0 browser offer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
    for (const track of remoteTrackPlan) {
      const mediaTrack = new FakeMediaStreamTrack(track.id, track.kind);
      const stream = new FakeMediaStream([mediaTrack]);
      this.ontrack?.({ track: mediaTrack, streams: [stream] } as unknown as RTCTrackEvent);
    }
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit): Promise<void> {}

  async getStats(): Promise<Map<string, Record<string, unknown>>> {
    const nextReport = TestPeerConnection.statsReports.shift();
    if (nextReport) return nextReport;
    return new Map<string, Record<string, unknown>>([
      [
        "pair-1",
        {
          id: "pair-1",
          type: "candidate-pair",
          selected: true,
          state: "succeeded",
          localCandidateId: "local-1",
          remoteCandidateId: "remote-1",
        },
      ],
      ["local-1", { id: "local-1", type: "local-candidate", candidateType: "relay", protocol: "udp", address: "203.0.113.10" }],
      ["remote-1", { id: "remote-1", type: "remote-candidate", candidateType: "relay", address: "203.0.113.11" }],
    ]);
  }

  close(): void {
    TestPeerConnection.closed = true;
  }

  static closeDataChannel(label: string): void {
    const channel = TestPeerConnection.channels[label];
    if (!channel) throw new Error(`Missing data channel ${label}`);
    Object.defineProperty(channel, "readyState", { value: "closed", configurable: true });
    channel.onclose?.(new Event("close"));
  }
}

class FakeMediaStreamTrack {
  constructor(
    readonly id: string,
    readonly kind: "audio" | "video",
  ) {}
}

class FakeMediaStream {
  private readonly tracks: FakeMediaStreamTrack[];

  constructor(tracks: FakeMediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }

  addTrack(track: FakeMediaStreamTrack): void {
    this.tracks.push(track);
  }

  getTracks(): FakeMediaStreamTrack[] {
    return [...this.tracks];
  }

  getVideoTracks(): FakeMediaStreamTrack[] {
    return this.tracks.filter((track) => track.kind === "video");
  }
}
