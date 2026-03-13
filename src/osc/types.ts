export type BusType = "input" | "playback" | "output";

export interface ChannelState {
  gain: number;     // 0.0–1.0 OSC value (input bus only, maps to 0–65 dB)
  phantom: boolean; // input bus only
  volume: number;   // 0.0–1.0 OSC value
  mute: boolean;
}

export function stateKey(bus: BusType, channel: number): string {
  return `${bus}:${channel}`;
}

export function defaultChannelState(): ChannelState {
  return { gain: 0, phantom: false, volume: 0, mute: false };
}

export const BUS_OSC_MAP: Record<BusType, string> = {
  input: "/1/busInput",
  playback: "/1/busPlayback",
  output: "/1/busOutput",
};
