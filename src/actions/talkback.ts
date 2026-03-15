import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";

type TalkbackSettings = Record<string, never>;

type TalkbackListener = (on: boolean) => void;
type ConnectionListener = (connected: boolean) => void;

@action({ UUID: "com.edvinlandvik.totalmix-ufx.talkback" })
export class Talkback extends SingletonAction<TalkbackSettings> {
  private listeners = new Map<string, TalkbackListener>();
  private connectionListeners = new Map<string, ConnectionListener>();

  override async onWillAppear(ev: WillAppearEvent<TalkbackSettings>): Promise<void> {
    const globalState = oscBridge.getGlobalState();

    if ("setState" in ev.action) {
      (ev.action as { setState(state: number): Promise<void> }).setState(globalState.talkback ? 1 : 0);
    }

    const listener: TalkbackListener = (on) => {
      if ("setState" in ev.action) {
        (ev.action as { setState(state: number): Promise<void> }).setState(on ? 1 : 0);
      }
    };
    this.listeners.set(ev.action.id, listener);
    oscBridge.on("talkbackChanged", listener);

    const connListener: ConnectionListener = (connected) => {
      if (connected) {
        const gs = oscBridge.getGlobalState();
        if ("setState" in ev.action) {
          (ev.action as { setState(state: number): Promise<void> }).setState(gs.talkback ? 1 : 0);
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

  override async onWillDisappear(ev: WillDisappearEvent<TalkbackSettings>): Promise<void> {
    const listener = this.listeners.get(ev.action.id);
    if (listener) {
      oscBridge.off("talkbackChanged", listener);
      this.listeners.delete(ev.action.id);
    }
    const connListener = this.connectionListeners.get(ev.action.id);
    if (connListener) {
      oscBridge.off("connectionChanged", connListener);
      this.connectionListeners.delete(ev.action.id);
    }
  }

  override async onKeyDown(_ev: KeyDownEvent<TalkbackSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    await oscBridge.toggleTalkback();
  }
}
