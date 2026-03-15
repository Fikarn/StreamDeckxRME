import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";

type MonoSettings = Record<string, never>;

type MonoListener = (on: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.mono" })
export class Mono extends SingletonAction<MonoSettings> {
  private listeners = new Map<string, MonoListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<MonoSettings>): Promise<void> {
    const globalState = oscBridge.getGlobalState();

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(globalState.mono ? 1 : 0);
    }

    const listener: MonoListener = (on) => {
      if ("setState" in ev.action) {
        (ev.action as { setState(state: number): Promise<void> }).setState(on ? 1 : 0);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("monoChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const gs = oscBridge.getGlobalState();
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(gs.mono ? 1 : 0);
        }
      } else {
        if ("setTitle" in ev.action) {
          (ev.action as { setTitle(title: string): Promise<void> }).setTitle("OFFLINE");
        }
      }
    };
    this.connectionListeners.set(ev.action.id, connListener);
    oscBridge.on("connectionChanged", connListener);
  }

  override async onWillDisappear(ev: WillDisappearEvent<MonoSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("monoChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(_ev: KeyDownEvent<MonoSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    await oscBridge.toggleMono();
  }
}
