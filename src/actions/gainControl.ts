import {
  action,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import { oscToGainDb } from "../utils/converters.js";
import type { BusType } from "../osc/types.js";

type GainSettings = {
  channel: number;
};

type GainListener = (bus: BusType, ch: number, db: number) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.gain-control" })
export class GainControl extends SingletonAction<GainSettings> {
  private listeners = new Map<string, GainListener>();

  override async onWillAppear(ev: WillAppearEvent<GainSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;
    const state = oscBridge.getState("input", channel);

    this.updateFeedback(ev.action, oscToGainDb(state.gain), channel);

    const listener: GainListener = (bus, ch, db) => {
      if (bus === "input" && ch === channel) {
        this.updateFeedback(ev.action, db, channel);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("gainChanged", listener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<GainSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("gainChanged", listener);
      this.listeners.delete(ev.action.id);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<GainSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;
    await oscBridge.adjustGain(channel, ev.payload.ticks);
  }

  private updateFeedback(actionInstance: WillAppearEvent<GainSettings>["action"], db: number, channel: number): void {
    if ("setFeedback" in actionInstance) {
      (actionInstance as { setFeedback(payload: Record<string, unknown>): Promise<void> }).setFeedback({
        title: `AN ${channel}`,
        value: { value: `${db} dB`, color: db >= 65 ? "#E53935" : "#E8E8EC" },
        indicator: {
          value: Math.round((db / 65) * 100),
          bar_fill_c: db > 55 ? "#E53935" : db > 45 ? "#FF6B35" : "#00C896",
        },
      });
    }
  }
}
