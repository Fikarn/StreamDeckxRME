import { EventEmitter } from "node:events";
import { TotalmixClient } from "./totalmixClient.js";
import { TotalmixServer } from "./totalmixServer.js";
import {
  BusType,
  ChannelState,
  stateKey,
  defaultChannelState,
} from "./types.js";
import { gainDbToOsc, oscToGainDb } from "../utils/converters.js";

// Step size for volume adjustments per encoder tick (OSC 0–1 range)
const VOLUME_STEP = 0.01;
// Step size for gain adjustments per encoder tick (1 dB)
const GAIN_STEP_DB = 1;

export class OscBridge extends EventEmitter {
  private client: TotalmixClient;
  private server: TotalmixServer;
  private state = new Map<string, ChannelState>();
  private activeBus: BusType = "input";
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    host: string = "127.0.0.1",
    sendPort: number = 7001,
    recvPort: number = 9001
  ) {
    super();
    this.client = new TotalmixClient(host, sendPort);
    this.server = new TotalmixServer(recvPort);
  }

  private getOrCreate(bus: BusType, channel: number): ChannelState {
    const key = stateKey(bus, channel);
    let s = this.state.get(key);
    if (!s) {
      s = defaultChannelState();
      this.state.set(key, s);
    }
    return s;
  }

  getState(bus: BusType, channel: number): ChannelState {
    return { ...this.getOrCreate(bus, channel) };
  }

  async start(): Promise<void> {
    await this.server.start();
    this.server.on("osc", (address: string, args: unknown[]) => {
      this.handleOsc(address, args);
    });
    this.startHeartbeat();
    console.log("[OscBridge] Started");
  }

  private handleOsc(address: string, args: unknown[]): void {
    const value = typeof args[0] === "number" ? args[0] : parseFloat(String(args[0]));
    if (isNaN(value)) return;

    // Bus selection feedback
    if (address === "/1/busInput") {
      if (value === 1) this.activeBus = "input";
      return;
    }
    if (address === "/1/busPlayback") {
      if (value === 1) this.activeBus = "playback";
      return;
    }
    if (address === "/1/busOutput") {
      if (value === 1) this.activeBus = "output";
      return;
    }

    // Gain: /1/gainN
    const gainMatch = address.match(/^\/1\/gain(\d+)$/);
    if (gainMatch) {
      const ch = parseInt(gainMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.gain = value;
      this.emit("gainChanged", bus, ch, oscToGainDb(value));
      return;
    }

    // Phantom: /1/phantomN
    const phantomMatch = address.match(/^\/1\/phantom(\d+)$/);
    if (phantomMatch) {
      const ch = parseInt(phantomMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.phantom = value >= 0.5;
      this.emit("phantomChanged", bus, ch, state.phantom);
      return;
    }

    // Volume: /1/volumeN
    const volumeMatch = address.match(/^\/1\/volume(\d+)$/);
    if (volumeMatch) {
      const ch = parseInt(volumeMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.volume = value;
      this.emit("volumeChanged", bus, ch, value);
      return;
    }

    // Mute: /1/muteN
    const muteMatch = address.match(/^\/1\/mute(\d+)$/);
    if (muteMatch) {
      const ch = parseInt(muteMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.mute = value >= 0.5;
      this.emit("muteChanged", bus, ch, state.mute);
      return;
    }
  }

  // --- Command methods ---

  async adjustGain(channel: number, ticks: number): Promise<void> {
    const state = this.getOrCreate("input", channel);
    const currentDb = oscToGainDb(state.gain);
    const newDb = Math.max(0, Math.min(65, currentDb + ticks * GAIN_STEP_DB));
    const oscVal = gainDbToOsc(newDb);
    state.gain = oscVal;
    try {
      await this.client.setGain(channel, oscVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set gain: ${err}`);
    }
    this.emit("gainChanged", "input", channel, newDb);
  }

  async togglePhantom(channel: number): Promise<void> {
    const state = this.getOrCreate("input", channel);
    const newVal = !state.phantom;
    state.phantom = newVal;
    try {
      await this.client.setPhantom(channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set phantom: ${err}`);
    }
    this.emit("phantomChanged", "input", channel, newVal);
  }

  async adjustVolume(bus: BusType, channel: number, ticks: number): Promise<void> {
    const state = this.getOrCreate(bus, channel);
    const newVal = Math.max(0, Math.min(1, state.volume + ticks * VOLUME_STEP));
    state.volume = newVal;
    try {
      await this.client.setVolume(bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set volume: ${err}`);
    }
    this.emit("volumeChanged", bus, channel, newVal);
  }

  async toggleMute(bus: BusType, channel: number): Promise<void> {
    const state = this.getOrCreate(bus, channel);
    const newVal = !state.mute;
    state.mute = newVal;
    try {
      await this.client.setMute(bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set mute: ${err}`);
    }
    this.emit("muteChanged", bus, channel, newVal);
  }

  // --- Heartbeat ---

  private startHeartbeat(): void {
    const buses: BusType[] = ["input", "output"];
    let idx = 0;
    this.heartbeatInterval = setInterval(async () => {
      const bus = buses[idx % buses.length];
      idx++;
      try {
        await this.client.selectBusForRefresh(bus);
      } catch (err) {
        console.error(`[OscBridge] Heartbeat error: ${err}`);
      }
    }, 5000);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.server.close();
    this.client.close();
    console.log("[OscBridge] Stopped");
  }
}

// Singleton instance
export const oscBridge = new OscBridge();
