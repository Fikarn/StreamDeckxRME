import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";
import type { BusType } from "../osc/types.js";

type SoloSettings = {
  bus: BusType;
  channel: number;
  label: string;
};

type SoloListener = (bus: BusType, ch: number, soloed: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.solo-toggle" })
export class SoloToggle extends SingletonAction<SoloSettings> {
  private listeners = new Map<string, SoloListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<SoloSettings>): Promise<void> {
    const { bus = "output", channel = 1, label } = ev.payload.settings;
    const state = oscBridge.getState(bus, channel);

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(state.solo ? 1 : 0);
    }
    this.updateTitle(ev.action, label, bus, channel);

    const listener: SoloListener = (b, ch, soloed) => {
      if (b === bus && ch === channel) {
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(soloed ? 1 : 0);
        }
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("soloChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const s = oscBridge.getState(bus, channel);
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(s.solo ? 1 : 0);
        }
        this.updateTitle(ev.action, label, bus, channel);
      } else {
        if ("setTitle" in ev.action) {
          (ev.action as { setTitle(title: string): Promise<void> }).setTitle("OFFLINE");
        }
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<SoloSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("soloChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<SoloSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const { bus = "output", channel = 1 } = ev.payload.settings;
    await oscBridge.toggleSolo(bus, channel);
  }

  private updateTitle(actionInstance: WillAppearEvent<SoloSettings>["action"], label: string | undefined, bus: BusType, channel: number): void {
    const title = label || `${bus.charAt(0).toUpperCase() + bus.slice(1)} ${channel}`;
    if ("setTitle" in actionInstance) {
      (actionInstance as { setTitle(title: string): Promise<void> }).setTitle(title);
    }
  }
}
