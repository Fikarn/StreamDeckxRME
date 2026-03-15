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
import { oscToGainDb } from "../utils/converters.js";
import type { BusType } from "../osc/types.js";

type PressAction = "mute" | "none";
type StepSize = "fine" | "normal" | "coarse";

type GainSettings = {
  channel: number;
  pressAction: PressAction;
  stepSize: StepSize;
};

const STEP_MAP: Record<StepSize, number> = {
  fine: 0.5,
  normal: 1,
  coarse: 2,
};

type GainListener = (bus: BusType, ch: number, db: number) => void;
type MuteListener = (bus: BusType, ch: number, muted: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.gain-control" })
export class GainControl extends SingletonAction<GainSettings> {
  private gainListeners = new Map<string, GainListener>();
  private muteListeners = new Map<string, MuteListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<GainSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;

    if ("setTriggerDescription" in ev.action) {
      const pressAction = ev.payload.settings.pressAction || "mute";
      (ev.action as { setTriggerDescription(d: Record<string, string>): Promise<void> }).setTriggerDescription({
        rotate: "Adjust gain",
        touch: pressAction === "mute" ? "Toggle mute" : "No action",
        longTouch: "Reset to 0 dB",
        push: pressAction === "mute" ? "Toggle mute" : "No action",
      });
    }

    if (oscBridge.connected) {
      const state = oscBridge.getState("input", channel);
      this.updateFeedback(ev.action, oscToGainDb(state.gain), state.mute, channel);
    } else {
      this.showOffline(ev.action);
    }

    const gainListener: GainListener = (bus, ch, db) => {
      if (bus === "input" && ch === channel) {
        const state = oscBridge.getState("input", channel);
        this.updateFeedback(ev.action, db, state.mute, channel);
      }
    };
    this.gainListeners.set(ev.action.id, gainListener);
    oscBridge.on("gainChanged", gainListener);

    const muteListener: MuteListener = (bus, ch, muted) => {
      if (bus === "input" && ch === channel) {
        const state = oscBridge.getState("input", channel);
        this.updateFeedback(ev.action, oscToGainDb(state.gain), muted, channel);
      }
    };
    this.muteListeners.set(ev.action.id, muteListener);
    oscBridge.on("muteChanged", muteListener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const state = oscBridge.getState("input", channel);
        this.updateFeedback(ev.action, oscToGainDb(state.gain), state.mute, channel);
      } else {
        this.showOffline(ev.action);
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<GainSettings>): Promise<void> {
    const gainListener = this.gainListeners.get(ev.action.id);
    if (gainListener) {
      oscBridge.off("gainChanged", gainListener);
      this.gainListeners.delete(ev.action.id);
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

  override async onDialRotate(ev: DialRotateEvent<GainSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const channel = ev.payload.settings.channel || 1;
    const stepSize = ev.payload.settings.stepSize || "normal";
    const baseStep = STEP_MAP[stepSize] ?? STEP_MAP.normal;
    const multiplier = Math.min(4, 1 + Math.abs(ev.payload.ticks) * 0.5);
    const step = baseStep * multiplier;
    await oscBridge.adjustGain(channel, ev.payload.ticks > 0 ? 1 : -1, step);
  }

  override async onDialDown(ev: DialDownEvent<GainSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const channel = ev.payload.settings.channel || 1;
    const pressAction = ev.payload.settings.pressAction || "mute";
    if (pressAction === "mute") {
      await oscBridge.toggleMute("input", channel);
    }
  }

  override async onTouchTap(ev: TouchTapEvent<GainSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const channel = ev.payload.settings.channel || 1;
    const pressAction = ev.payload.settings.pressAction || "mute";

    if (ev.payload.hold) {
      // Long touch: reset gain to 0 dB
      await oscBridge.setGain(channel, 0);
    } else if (pressAction === "mute") {
      await oscBridge.toggleMute("input", channel);
    }
  }

  private updateFeedback(
    actionInstance: WillAppearEvent<GainSettings>["action"],
    db: number,
    muted: boolean,
    channel: number
  ): void {
    if (!("setFeedback" in actionInstance)) return;
    const fb = actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> };

    if (muted) {
      fb.setFeedback({
        title: `AN ${channel}`,
        value: { value: "MUTED", color: "#E53935" },
        indicator: {
          value: Math.round((db / 65) * 100),
          bar_fill_c: "#E53935",
        },
      });
    } else {
      fb.setFeedback({
        title: `AN ${channel}`,
        value: { value: `${db} dB`, color: db >= 65 ? "#E53935" : "#E8E8EC" },
        indicator: {
          value: Math.round((db / 65) * 100),
          bar_fill_c: db > 55 ? "#E53935" : db > 45 ? "#FF6B35" : "#00C896",
        },
      });
    }
  }

  private showOffline(actionInstance: WillAppearEvent<GainSettings>["action"]): void {
    if ("setFeedback" in actionInstance) {
      (actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> }).setFeedback({
        title: "OFFLINE",
        value: { value: "No Connection", color: "#E53935" },
        indicator: { value: 0, bar_fill_c: "#E53935" },
      });
    }
  }
}
