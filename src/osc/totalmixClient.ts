import { Client, Message } from "node-osc";
import { BusType, BUS_OSC_MAP } from "./types.js";

interface QueuedCommand {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class TotalmixClient {
  private client: Client;
  private queue: QueuedCommand[] = [];
  private processing = false;

  constructor(
    private host: string = "127.0.0.1",
    private port: number = 7001
  ) {
    this.client = new Client(host, port);
  }

  private send(address: string, value: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const msg = new Message(address, value);
      this.client.send(msg, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async enqueue(fn: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const cmd = this.queue.shift()!;
      try {
        await cmd.execute();
        cmd.resolve();
      } catch (err) {
        cmd.reject(err as Error);
      }
    }
    this.processing = false;
  }

  async selectBus(bus: BusType): Promise<void> {
    const address = BUS_OSC_MAP[bus];
    await this.send(address, 1);
  }

  async setGain(channel: number, oscVal: number): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus("input");
      await this.send(`/1/gain${channel}`, oscVal);
    });
  }

  async setPhantom(channel: number, on: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus("input");
      await this.send(`/1/phantom${channel}`, on ? 1 : 0);
    });
  }

  async setVolume(bus: BusType, channel: number, oscVal: number): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus(bus);
      await this.send(`/1/volume${channel}`, oscVal);
    });
  }

  async setMute(bus: BusType, channel: number, muted: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus(bus);
      await this.send(`/1/mute${channel}`, muted ? 1 : 0);
    });
  }

  async setSolo(bus: BusType, channel: number, on: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus(bus);
      await this.send(`/1/solo${channel}`, on ? 1 : 0);
    });
  }

  async setPhase(bus: BusType, channel: number, on: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus(bus);
      await this.send(`/1/phase${channel}`, on ? 1 : 0);
    });
  }

  async sendGlobal(address: string, value: number): Promise<void> {
    return this.enqueue(async () => {
      await this.send(address, value);
    });
  }

  async selectBusForRefresh(bus: BusType): Promise<void> {
    return this.enqueue(async () => {
      await this.selectBus(bus);
    });
  }

  close(): void {
    this.client.close();
  }
}
