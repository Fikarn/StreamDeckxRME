import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import { formatVolume } from "../utils/converters.js";
import type { BusType } from "../osc/types.js";

type PressAction = "mute" | "none";
type StepSize = "fine" | "normal" | "coarse";

type VolumeSettings = {
  bus: BusType;
  channel: number;
  label: string;
  pressAction: PressAction;
  stepSize: StepSize;
};

const STEP_MAP: Record<StepSize, number> = {
  fine: 0.005,
  normal: 0.01,
  coarse: 0.02,
};

// Unity gain = 0 dB ≈ 0.82 in OSC range
const UNITY_OSC = 0.82;

type VolumeListener = (bus: BusType, ch: number, oscVal: number) => void;
type MuteListener = (bus: BusType, ch: number, muted: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.volume-control" })
export class VolumeControl extends SingletonAction<VolumeSettings> {
  private volumeListeners = new Map<string, VolumeListener>();
  private muteListeners = new Map<string, MuteListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
    const { bus = "output", channel = 1, label = "Volume" } = ev.payload.settings;

    if ("setTriggerDescription" in ev.action) {
      const pressAction = ev.payload.settings.pressAction || "mute";
      (ev.action as { setTriggerDescription(d: Record<string, string>): Promise<void> }).setTriggerDescription({
        rotate: "Adjust volume",
        touch: pressAction === "mute" ? "Toggle mute" : "No action",
        longTouch: "Reset to 0 dB",
        push: pressAction === "mute" ? "Toggle mute" : "No action",
      });
    }

    if (oscBridge.connected) {
      const state = oscBridge.getState(bus, channel);
      this.updateFeedback(ev.action, state.volume, state.mute, label);
    } else {
      this.showOffline(ev.action);
    }

    const volListener: VolumeListener = (b, ch, oscVal) => {
      if (b === bus && ch === channel) {
        const state = oscBridge.getState(bus, channel);
        this.updateFeedback(ev.action, oscVal, state.mute, label);
      }
    };
    this.volumeListeners.set(ev.action.id, volListener);
    oscBridge.on("volumeChanged", volListener);

    const muteListener: MuteListener = (b, ch, muted) => {
      if (b === bus && ch === channel) {
        const state = oscBridge.getState(bus, channel);
        this.updateFeedback(ev.action, state.volume, muted, label);
      }
    };
    this.muteListeners.set(ev.action.id, muteListener);
    oscBridge.on("muteChanged", muteListener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const state = oscBridge.getState(bus, channel);
        this.updateFeedback(ev.action, state.volume, state.mute, label);
      } else {
        this.showOffline(ev.action);
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
    const volListener = this.volumeListeners.get(ev.action.id);
    if (volListener) {
      oscBridge.off("volumeChanged", volListener);
      this.volumeListeners.delete(ev.action.id);
    }
    const muteListener = this.muteListeners.get(ev.action.id);
    if (muteListener) {
      oscBridge.off("muteChanged", muteListener);
      this.muteListeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<VolumeSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const { bus = "output", channel = 1, stepSize = "normal" } = ev.payload.settings;
    const baseStep = STEP_MAP[stepSize] ?? STEP_MAP.normal;
    const multiplier = Math.min(4, 1 + Math.abs(ev.payload.ticks) * 0.5);
    const step = baseStep * multiplier;
    await oscBridge.adjustVolume(bus, channel, ev.payload.ticks > 0 ? 1 : -1, step);
  }

  override async onDialDown(ev: DialDownEvent<VolumeSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const { bus = "output", channel = 1, pressAction = "mute" } = ev.payload.settings;
    if (pressAction === "mute") {
      await oscBridge.toggleMute(bus, channel);
    }
  }

  override async onTouchTap(ev: TouchTapEvent<VolumeSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const { bus = "output", channel = 1, pressAction = "mute" } = ev.payload.settings;

    if (ev.payload.hold) {
      // Long touch: reset to unity (0 dB)
      await oscBridge.setVolume(bus, channel, UNITY_OSC);
    } else if (pressAction === "mute") {
      await oscBridge.toggleMute(bus, channel);
    }
  }

  private updateFeedback(
    actionInstance: WillAppearEvent<VolumeSettings>["action"],
    oscVal: number,
    muted: boolean,
    label: string
  ): void {
    if (!("setFeedback" in actionInstance)) return;
    const fb = actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> };

    if (muted) {
      fb.setFeedback({
        title: label,
        value: { value: "MUTED", color: "#E53935" },
        indicator: {
          value: Math.round(oscVal * 100),
          bar_fill_c: "#E53935",
        },
      });
    } else {
      fb.setFeedback({
        title: label,
        value: { value: formatVolume(oscVal), color: oscVal > 0.82 ? "#FF8C00" : "#E8E8EC" },
        indicator: Math.round(oscVal * 100),
      });
    }
  }

  private showOffline(actionInstance: WillAppearEvent<VolumeSettings>["action"]): void {
    if ("setFeedback" in actionInstance) {
      (actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> }).setFeedback({
        title: "OFFLINE",
        value: { value: "No Connection", color: "#E53935" },
        indicator: 0,
      });
    }
  }
}
