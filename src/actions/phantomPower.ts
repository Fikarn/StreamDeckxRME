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
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.phantom-power" })
export class PhantomPower extends SingletonAction<PhantomSettings> {
  private listeners = new Map<string, PhantomListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<PhantomSettings>): Promise<void> {
    const channel = ev.payload.settings.channel || 1;
    const state = oscBridge.getState("input", channel);

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(state.phantom ? 1 : 0);
    }
    this.updateTitle(ev.action, channel);

    const listener: PhantomListener = (bus, ch, on) => {
      if (bus === "input" && ch === channel) {
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(on ? 1 : 0);
        }
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("phantomChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const s = oscBridge.getState("input", channel);
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(s.phantom ? 1 : 0);
        }
        this.updateTitle(ev.action, channel);
      } else {
        if ("setTitle" in ev.action) {
          (ev.action as { setTitle(title: string): Promise<void> }).setTitle("OFFLINE");
        }
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<PhantomSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("phantomChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PhantomSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const channel = ev.payload.settings.channel || 1;
    await oscBridge.togglePhantom(channel);
  }

  private updateTitle(actionInstance: WillAppearEvent<PhantomSettings>["action"], channel: number): void {
    if ("setTitle" in actionInstance) {
      (actionInstance as { setTitle(title: string): Promise<void> }).setTitle(`AN ${channel}`);
    }
  }
}
