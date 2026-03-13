import {
  action,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import { formatVolume } from "../utils/converters.js";
import type { BusType } from "../osc/types.js";

type VolumeSettings = {
  bus: BusType;
  channel: number;
  label: string;
};

type VolumeListener = (bus: BusType, ch: number, oscVal: number) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.volume-control" })
export class VolumeControl extends SingletonAction<VolumeSettings> {
  private listeners = new Map<string, VolumeListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
    const { bus = "output", channel = 1, label = "Volume" } = ev.payload.settings;

    if (oscBridge.connected) {
      const state = oscBridge.getState(bus, channel);
      this.updateFeedback(ev.action, state.volume, label);
    } else {
      this.showOffline(ev.action);
    }

    const listener: VolumeListener = (b, ch, oscVal) => {
      if (b === bus && ch === channel) {
        this.updateFeedback(ev.action, oscVal, label);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("volumeChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const state = oscBridge.getState(bus, channel);
        this.updateFeedback(ev.action, state.volume, label);
      } else {
        this.showOffline(ev.action);
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("volumeChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<VolumeSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const { bus = "output", channel = 1 } = ev.payload.settings;
    await oscBridge.adjustVolume(bus, channel, ev.payload.ticks);
  }

  private updateFeedback(actionInstance: WillAppearEvent<VolumeSettings>["action"], oscVal: number, label: string): void {
    if ("setFeedback" in actionInstance) {
      (actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> }).setFeedback({
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
