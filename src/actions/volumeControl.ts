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

@action({ UUID: "com.edvinlandvik.totalmix-ufx.volume-control" })
export class VolumeControl extends SingletonAction<VolumeSettings> {
  private listeners = new Map<string, VolumeListener>();

  override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
    const { bus = "output", channel = 1, label = "Volume" } = ev.payload.settings;
    const state = oscBridge.getState(bus, channel);

    this.updateFeedback(ev.action, state.volume, label);

    const listener: VolumeListener = (b, ch, oscVal) => {
      if (b === bus && ch === channel) {
        this.updateFeedback(ev.action, oscVal, label);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("volumeChanged", listener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("volumeChanged", listener);
      this.listeners.delete(ev.action.id);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<VolumeSettings>): Promise<void> {
    const { bus = "output", channel = 1 } = ev.payload.settings;
    await oscBridge.adjustVolume(bus, channel, ev.payload.ticks);
  }

  private updateFeedback(actionInstance: WillAppearEvent<VolumeSettings>["action"], oscVal: number, label: string): void {
    if ("setFeedback" in actionInstance) {
      (actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> }).setFeedback({
        title: label,
        value: formatVolume(oscVal),
        indicator: Math.round(oscVal * 100),
      });
    }
  }
}
