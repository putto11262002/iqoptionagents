import type { Position, BlitzOptionConfig } from "../types/index.ts";
import type { EnvironmentSnapshot } from "./types.ts";

export class EnvironmentState {
  balance: number = 0;
  openPositions: Position[] = [];
  closedCount: number = 0;
  winCount: number = 0;
  lossCount: number = 0;
  totalPnl: number = 0;
  availableAssets: BlitzOptionConfig[] = [];
  serverTime: number = 0;

  /** Update state from a position-changed event */
  onPositionChanged(pos: Position): void {
    if (pos.status === "open") {
      // Add to open positions (avoid duplicates)
      const existing = this.openPositions.findIndex(p => p.id === pos.id);
      if (existing >= 0) {
        this.openPositions[existing] = pos;
      } else {
        this.openPositions.push(pos);
      }
    } else if (pos.status === "closed") {
      // Remove from open positions
      this.openPositions = this.openPositions.filter(p => p.id !== pos.id);
      this.closedCount++;
      this.totalPnl += pos.pnl || 0;

      if (pos.close_reason === "win") {
        this.winCount++;
      } else {
        this.lossCount++;
      }
    }
  }

  /** Get a snapshot of current state */
  snapshot(): EnvironmentSnapshot {
    return {
      balance: this.balance,
      openPositions: [...this.openPositions],
      closedCount: this.closedCount,
      winCount: this.winCount,
      lossCount: this.lossCount,
      totalPnl: this.totalPnl,
      availableAssets: this.availableAssets,
      serverTime: this.serverTime,
    };
  }
}
