import { IQWebSocket } from "./client/ws.ts";
import { Protocol } from "./client/protocol.ts";
import { login, authenticateWs } from "./client/auth.ts";
import { AccountAPI } from "./api/account.ts";
import { AssetsAPI } from "./api/assets.ts";
import { CandlesAPI } from "./api/candles.ts";
import { TradingAPI } from "./api/trading.ts";
import { SubscriptionsAPI } from "./api/subscriptions.ts";
import { TradingEnvironment } from "./env/environment.ts";
import { MomentumAgent } from "./bot/agents/momentum.ts";
import type { BlitzOptionConfig } from "./types/index.ts";

// ─── Config ───

const IQ_EMAIL = process.env.IQ_EMAIL;
const IQ_PASSWORD = process.env.IQ_PASSWORD;
const TRADE_AMOUNT = Number(process.env.TRADE_AMOUNT) || 30;
const EXPIRATION_SIZE = Number(process.env.EXPIRATION_SIZE) || 60;
const CANDLE_SIZE = Number(process.env.CANDLE_SIZE) || 1;

// Asset selection: pass as CLI arg or env var
// Examples:
//   bun start -- 76                    (by ID)
//   bun start -- EURUSD                (by name, partial match)
//   ACTIVE=AAPL bun start              (env var)
//   bun start -- list                  (list all available assets)
const ACTIVE_ARG = process.argv[2] || process.env.ACTIVE || "";

if (!IQ_EMAIL || !IQ_PASSWORD) {
  console.error("Set IQ_EMAIL and IQ_PASSWORD in .env");
  process.exit(1);
}

// ─── Helpers ───

function findAsset(configs: BlitzOptionConfig[], query: string): BlitzOptionConfig | undefined {
  if (!query) return undefined;

  // Try exact ID match
  const asId = parseInt(query);
  if (!isNaN(asId)) {
    return configs.find(c => c.active_id === asId);
  }

  // Try exact name match (case-insensitive)
  const q = query.toUpperCase();
  const exact = configs.find(c => c.name.toUpperCase() === q || c.description.toUpperCase() === q);
  if (exact) return exact;

  // Try partial match
  return configs.find(c =>
    c.name.toUpperCase().includes(q) || c.description.toUpperCase().includes(q)
  );
}

function printAssetTable(configs: BlitzOptionConfig[]) {
  console.log("\n  ID    | Name              | Payout | Min Bet | Expiry Times     | Status");
  console.log("  ------+-------------------+--------+---------+------------------+--------");
  for (const c of configs) {
    const payout = c.profit_commission > 0 ? `${100 - c.profit_commission}%` : "?";
    const status = c.is_suspended ? "SUSPENDED" : c.is_enabled ? "OPEN" : "CLOSED";
    const expiry = c.expiration_times.length > 0 ? c.expiration_times.join(",") + "s" : "-";
    console.log(
      `  ${String(c.active_id).padEnd(6)}| ${c.description.padEnd(18)}| ${payout.padEnd(7)}| $${String(c.minimal_bet).padEnd(7)}| ${expiry.padEnd(17)}| ${status}`
    );
  }
}

// ─── Main ───

async function main() {
  console.log("=== IQ Option Blitz Trading Bot ===\n");

  // Step 1: Login via HTTP
  console.log("[1] Logging in...");
  const { ssid } = await login(IQ_EMAIL!, IQ_PASSWORD!);
  console.log("[1] Got ssid");

  // Step 2: Connect WebSocket
  console.log("[2] Connecting WebSocket...");
  const ws = new IQWebSocket();
  await ws.connect();

  // Step 3: Protocol & Auth
  const protocol = new Protocol(ws);
  console.log("[3] Authenticating WebSocket...");
  await authenticateWs(protocol, ssid);

  // Step 4: Initialize APIs
  const account = new AccountAPI(protocol, ws);
  const assets = new AssetsAPI(protocol);
  const candles = new CandlesAPI(protocol, ws);
  const trading = new TradingAPI(protocol, ws);
  const subscriptions = new SubscriptionsAPI(protocol, ws);

  // Step 5: Initialize Environment
  console.log("\n[4] Initializing environment...");
  const env = new TradingEnvironment(
    protocol, ws, account, assets, candles, trading, subscriptions,
  );
  await env.initialize();

  const availableConfigs = env.getAvailableAssets();

  // Handle "list" command — print all assets and exit
  if (ACTIVE_ARG.toLowerCase() === "list") {
    console.log("\n  Available Blitz Option Assets:");
    printAssetTable(availableConfigs);
    console.log(`\n  Total: ${availableConfigs.length} available assets`);
    console.log("\n  Usage: bun start -- <ID or NAME> to trade a specific asset");
    ws.close();
    return;
  }

  // Select asset
  let targetConfig: BlitzOptionConfig | undefined;

  if (ACTIVE_ARG) {
    targetConfig = findAsset(availableConfigs, ACTIVE_ARG);
    if (!targetConfig) {
      console.error(`\n  Asset "${ACTIVE_ARG}" not found. Use "bun start -- list" to see available assets.`);
      ws.close();
      return;
    }
  } else {
    // Default: pick first available OTC forex (usually 24/7)
    const preferredIds = [76, 1, 816, 1938, 2276];
    for (const id of preferredIds) {
      targetConfig = availableConfigs.find(c => c.active_id === id);
      if (targetConfig) break;
    }
    if (!targetConfig) targetConfig = availableConfigs[0];
  }

  if (!targetConfig) {
    console.error("No available assets found!");
    ws.close();
    return;
  }

  const profitPercent = targetConfig.profit_commission > 0
    ? 100 - targetConfig.profit_commission
    : 86;

  console.log(`\n  >> Selected: ${targetConfig.description} (ID: ${targetConfig.active_id})`);
  console.log(`     Payout: ${profitPercent}% | Min bet: $${targetConfig.minimal_bet} | Expiry options: ${targetConfig.expiration_times.join(",")}s`);
  console.log(`     Trade amount: $${TRADE_AMOUNT} | Expiry: ${EXPIRATION_SIZE}s | Candle size: ${CANDLE_SIZE}s\n`);

  // Step 6: Create and run agent
  const agent = new MomentumAgent({
    activeId: targetConfig.active_id,
    candleSize: CANDLE_SIZE,
    lookback: 3,
    tradeAmount: TRADE_AMOUNT,
    expirationSize: EXPIRATION_SIZE,
    profitPercent,
  });

  await env.runAgent(agent);

  console.log("Bot running. Press Ctrl+C to stop.\n");

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    ws.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
