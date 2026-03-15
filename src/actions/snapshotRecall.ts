import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { oscBridge } from "../osc/oscBridge.js";

type SnapshotSettings = {
  slot: number;
  label: string;
};

@action({ UUID: "com.edvinlandvik.totalmix-ufx.snapshot-recall" })
export class SnapshotRecall extends SingletonAction<SnapshotSettings> {
  override async onWillAppear(ev: WillAppearEvent<SnapshotSettings>): Promise<void> {
    const { slot = 1, label } = ev.payload.settings;
    const title = label || `Snapshot ${slot}`;
    if ("setTitle" in ev.action) {
      (ev.action as { setTitle(title: string): Promise<void> }).setTitle(title);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<SnapshotSettings>): Promise<void> {
    if (!oscBridge.connected) return;
    const slot = ev.payload.settings.slot || 1;
    await oscBridge.recallSnapshot(slot);
  }
}
