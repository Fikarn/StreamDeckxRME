import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import type { BusType } from "../osc/types.js";

type MuteSettings = {
  bus: BusType;
  channel: number;
  label: string;
};

type MuteListener = (bus: BusType, ch: number, muted: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.mute-toggle" })
export class MuteToggle extends SingletonAction<MuteSettings> {
  private listeners = new Map<string, MuteListener>();

  override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
    const { bus = "output", channel = 1 } = ev.payload.settings;
    const state = oscBridge.getState(bus, channel);

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(state.mute ? 1 : 0);
    }

    const listener: MuteListener = (b, ch, muted) => {
      if (b === bus && ch === channel) {
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(muted ? 1 : 0);
        }
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("muteChanged", listener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<MuteSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("muteChanged", listener);
      this.listeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
    const { bus = "output", channel = 1 } = ev.payload.settings;
    await oscBridge.toggleMute(bus, channel);
  }
}
