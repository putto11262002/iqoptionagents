import type { IQWebSocket } from "../client/ws.ts";
import type { WsMessage } from "../types/index.ts";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export class MessageRecorder {
  private captured: Map<string, unknown[]> = new Map();
  private handler: ((msg: WsMessage) => void) | null = null;

  record(ws: IQWebSocket, messageNames: string[], outputDir: string): void {
    for (const name of messageNames) {
      this.captured.set(name, []);
    }

    this.handler = (msg: WsMessage) => {
      if (this.captured.has(msg.name)) {
        this.captured.get(msg.name)!.push(msg.msg);
        console.log(`[Recorder] Captured ${msg.name} (${this.captured.get(msg.name)!.length} total)`);
      }
    };

    ws.onAny(this.handler);
  }

  dump(outputDir: string): void {
    mkdirSync(outputDir, { recursive: true });
    for (const [name, messages] of this.captured) {
      const filename = name.replace(/\./g, "-") + ".json";
      const data = messages.length === 1 ? messages[0] : messages;
      writeFileSync(join(outputDir, filename), JSON.stringify(data, null, 2));
      console.log(`[Recorder] Wrote ${filename} (${messages.length} entries)`);
    }
  }

  stop(): void {
    this.handler = null;
    this.captured.clear();
  }
}
