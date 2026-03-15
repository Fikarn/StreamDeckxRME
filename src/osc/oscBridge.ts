import { EventEmitter } from "node:events";
import { TotalmixClient } from "./totalmixClient.js";
import { TotalmixServer } from "./totalmixServer.js";
import {
  BusType,
  ChannelState,
  GlobalState,
  stateKey,
  defaultChannelState,
  defaultGlobalState,
} from "./types.js";
import { gainDbToOsc, oscToGainDb } from "../utils/converters.js";

// Step size for volume adjustments per encoder tick (OSC 0–1 range)
const VOLUME_STEP = 0.01;
// Step size for gain adjustments per encoder tick (1 dB)
const GAIN_STEP_DB = 1;
// Timeout before marking TotalMix as disconnected (ms)
const CONNECTION_TIMEOUT_MS = 8000;

export class OscBridge extends EventEmitter {
  private client: TotalmixClient;
  private server: TotalmixServer;
  private state = new Map<string, ChannelState>();
  private globalState: GlobalState = defaultGlobalState();
  private activeBus: BusType = "input";
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;

  get connected(): boolean {
    return this._connected;
  }

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

  getGlobalState(): GlobalState {
    return { ...this.globalState };
  }

  private markConnected(): void {
    if (!this._connected) {
      this._connected = true;
      this.emit("connectionChanged", true);
      console.log("[OscBridge] Connected to TotalMix FX");
      // Trigger a full state refresh by cycling through all buses
      this.refreshAllBuses();
    }
    // Reset the connection timeout on every incoming message
    this.resetConnectionTimer();
  }

  private markDisconnected(): void {
    if (this._connected) {
      this._connected = false;
      this.emit("connectionChanged", false);
      console.log("[OscBridge] Lost connection to TotalMix FX");
    }
  }

  private resetConnectionTimer(): void {
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    this.connectionTimer = setTimeout(() => {
      this.markDisconnected();
    }, CONNECTION_TIMEOUT_MS);
  }

  private async refreshAllBuses(): Promise<void> {
    const buses: BusType[] = ["input", "playback", "output"];
    for (const bus of buses) {
      try {
        await this.client.selectBusForRefresh(bus);
      } catch (err) {
        console.error(`[OscBridge] Refresh error for ${bus}: ${err}`);
      }
    }
  }

  async start(): Promise<void> {
    await this.server.start();
    this.server.on("osc", (address: string, args: unknown[]) => {
      this.handleOsc(address, args);
    });
    this.startHeartbeat();
    // Start the connection timer — if no OSC arrives within timeout, we're disconnected
    this.resetConnectionTimer();
    console.log("[OscBridge] Started");
  }

  private handleOsc(address: string, args: unknown[]): void {
    // Any incoming OSC message means TotalMix is alive
    this.markConnected();

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

    // Global controls
    if (address === "/1/talkback") {
      this.globalState.talkback = value >= 0.5;
      this.emit("talkbackChanged", this.globalState.talkback);
      return;
    }
    if (address === "/1/mainDim") {
      this.globalState.dim = value >= 0.5;
      this.emit("dimChanged", this.globalState.dim);
      return;
    }
    if (address === "/1/mainMono") {
      this.globalState.mono = value >= 0.5;
      this.emit("monoChanged", this.globalState.mono);
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

    // Solo: /1/soloN
    const soloMatch = address.match(/^\/1\/solo(\d+)$/);
    if (soloMatch) {
      const ch = parseInt(soloMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.solo = value >= 0.5;
      this.emit("soloChanged", bus, ch, state.solo);
      return;
    }

    // Phase: /1/phaseN
    const phaseMatch = address.match(/^\/1\/phase(\d+)$/);
    if (phaseMatch) {
      const ch = parseInt(phaseMatch[1], 10);
      const bus = this.activeBus;
      const state = this.getOrCreate(bus, ch);
      state.phase = value >= 0.5;
      this.emit("phaseChanged", bus, ch, state.phase);
      return;
    }
  }

  // --- Command methods (mutate state only AFTER successful send) ---

  async adjustGain(channel: number, ticks: number, stepDb: number = GAIN_STEP_DB): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate("input", channel);
    const currentDb = oscToGainDb(state.gain);
    const newDb = Math.max(0, Math.min(65, currentDb + ticks * stepDb));
    const oscVal = gainDbToOsc(newDb);
    try {
      await this.client.setGain(channel, oscVal);
      state.gain = oscVal;
      this.emit("gainChanged", "input", channel, newDb);
    } catch (err) {
      console.error(`[OscBridge] Failed to set gain: ${err}`);
    }
  }

  async togglePhantom(channel: number): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate("input", channel);
    const newVal = !state.phantom;
    try {
      await this.client.setPhantom(channel, newVal);
      state.phantom = newVal;
      this.emit("phantomChanged", "input", channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set phantom: ${err}`);
    }
  }

  async adjustVolume(bus: BusType, channel: number, ticks: number, step: number = VOLUME_STEP): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate(bus, channel);
    const newVal = Math.max(0, Math.min(1, state.volume + ticks * step));
    try {
      await this.client.setVolume(bus, channel, newVal);
      state.volume = newVal;
      this.emit("volumeChanged", bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set volume: ${err}`);
    }
  }

  async setVolume(bus: BusType, channel: number, oscVal: number): Promise<void> {
    if (!this._connected) return;
    const clamped = Math.max(0, Math.min(1, oscVal));
    try {
      await this.client.setVolume(bus, channel, clamped);
      const state = this.getOrCreate(bus, channel);
      state.volume = clamped;
      this.emit("volumeChanged", bus, channel, clamped);
    } catch (err) {
      console.error(`[OscBridge] Failed to set volume: ${err}`);
    }
  }

  async setGain(channel: number, oscVal: number): Promise<void> {
    if (!this._connected) return;
    const clamped = Math.max(0, Math.min(1, oscVal));
    try {
      await this.client.setGain(channel, clamped);
      const state = this.getOrCreate("input", channel);
      state.gain = clamped;
      this.emit("gainChanged", "input", channel, oscToGainDb(clamped));
    } catch (err) {
      console.error(`[OscBridge] Failed to set gain: ${err}`);
    }
  }

  async toggleMute(bus: BusType, channel: number): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate(bus, channel);
    const newVal = !state.mute;
    try {
      await this.client.setMute(bus, channel, newVal);
      state.mute = newVal;
      this.emit("muteChanged", bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set mute: ${err}`);
    }
  }

  async toggleSolo(bus: BusType, channel: number): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate(bus, channel);
    const newVal = !state.solo;
    try {
      await this.client.setSolo(bus, channel, newVal);
      state.solo = newVal;
      this.emit("soloChanged", bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set solo: ${err}`);
    }
  }

  async togglePhase(bus: BusType, channel: number): Promise<void> {
    if (!this._connected) return;
    const state = this.getOrCreate(bus, channel);
    const newVal = !state.phase;
    try {
      await this.client.setPhase(bus, channel, newVal);
      state.phase = newVal;
      this.emit("phaseChanged", bus, channel, newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to set phase: ${err}`);
    }
  }

  async toggleTalkback(): Promise<void> {
    if (!this._connected) return;
    const newVal = !this.globalState.talkback;
    try {
      await this.client.sendGlobal("/1/talkback", newVal ? 1 : 0);
      this.globalState.talkback = newVal;
      this.emit("talkbackChanged", newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to toggle talkback: ${err}`);
    }
  }

  async toggleDim(): Promise<void> {
    if (!this._connected) return;
    const newVal = !this.globalState.dim;
    try {
      await this.client.sendGlobal("/1/mainDim", newVal ? 1 : 0);
      this.globalState.dim = newVal;
      this.emit("dimChanged", newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to toggle dim: ${err}`);
    }
  }

  async toggleMono(): Promise<void> {
    if (!this._connected) return;
    const newVal = !this.globalState.mono;
    try {
      await this.client.sendGlobal("/1/mainMono", newVal ? 1 : 0);
      this.globalState.mono = newVal;
      this.emit("monoChanged", newVal);
    } catch (err) {
      console.error(`[OscBridge] Failed to toggle mono: ${err}`);
    }
  }

  async recallSnapshot(slot: number): Promise<void> {
    if (!this._connected) return;
    try {
      await this.client.sendGlobal(`/1/snapshot${slot}`, 1);
    } catch (err) {
      console.error(`[OscBridge] Failed to recall snapshot: ${err}`);
    }
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
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    this.server.close();
    this.client.close();
    console.log("[OscBridge] Stopped");
  }
}

// Singleton instance
export const oscBridge = new OscBridge();
