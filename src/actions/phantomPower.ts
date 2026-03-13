import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import type { BusType } from "../osc/types.js";

type PhantomSettings = {
  channel: number;
};

type PhantomListener = (bus: BusType, ch: number, on: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.phantom-power" })
export class PhantomPower extends SingletonAction<PhantomSettings> {
  private listeners = new Map<string, PhantomListener>();

  override async onWillAppear(ev: WillAppearEvent<PhantomSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;
    const state = oscBridge.getState("input", channel);

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(state.phantom ? 1 : 0);
    }

    const listener: PhantomListener = (bus, ch, on) => {
      if (bus === "input" && ch === channel) {
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(on ? 1 : 0);
        }
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("phantomChanged", listener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<PhantomSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("phantomChanged", listener);
      this.listeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PhantomSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;
    await oscBridge.togglePhantom(channel);
  }
}
