import { Server } from "node-osc";
import { EventEmitter } from "node:events";

export class TotalmixServer extends EventEmitter {
  private server: Server | null = null;

  constructor(
    private port: number = 9001,
    private host: string = "0.0.0.0"
  ) {
    super();
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new Server(this.port, this.host, () => {
          console.log(`[OSC Server] Listening on ${this.host}:${this.port}`);
          resolve();
        });

        this.server.on("message", (msg: unknown[]) => {
          const address = msg[0] as string;
          const args = msg.slice(1);
          this.emit("osc", address, args);
        });

        this.server.on("bundle", (bundle: unknown[]) => {
          // bundle[0] is timetag, rest are messages
          for (let i = 1; i < bundle.length; i++) {
            const msg = bundle[i] as unknown[];
            if (Array.isArray(msg) && msg.length >= 1) {
              const address = msg[0] as string;
              const args = msg.slice(1);
              this.emit("osc", address, args);
            }
          }
        });

        this.server.on("error", (err: Error) => {
          console.error(`[OSC Server] Error: ${err.message}`);
          this.emit("error", err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  close(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
