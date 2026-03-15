import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";

type DimSettings = Record<string, never>;

type DimListener = (on: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.dim" })
export class Dim extends SingletonAction<DimSettings> {
  private listeners = new Map<string, DimListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<DimSettings>): Promise<void> {
    const globalState = oscBridge.getGlobalState();

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(globalState.dim ? 1 : 0);
    }

    const listener: DimListener = (on) => {
      if ("setState" in ev.action) {
        (ev.action as { setState(state: number): Promise<void> }).setState(on ? 1 : 0);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("dimChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const gs = oscBridge.getGlobalState();
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(gs.dim ? 1 : 0);
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

  override async onWillDisappear(ev: WillDisappearEvent<DimSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("dimChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(_ev: KeyDownEvent<DimSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    await oscBridge.toggleDim();
  }
}
