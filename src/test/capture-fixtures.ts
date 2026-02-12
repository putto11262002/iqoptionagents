/**
 * Capture real protocol responses from the live IQ Option server.
 * Writes them to src/test/fixtures/ for contract testing.
 *
 * Usage: bun run src/test/capture-fixtures.ts
 */
import { IQWebSocket } from "../client/ws.ts";
import { Protocol } from "../client/protocol.ts";
import { login, authenticateWs } from "../client/auth.ts";
import { AccountAPI } from "../api/account.ts";
import { AssetsAPI } from "../api/assets.ts";
import { CandlesAPI } from "../api/candles.ts";
import { TradingAPI } from "../api/trading.ts";
import { SubscriptionsAPI } from "../api/subscriptions.ts";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");
const IQ_EMAIL = process.env.IQ_EMAIL!;
const IQ_PASSWORD = process.env.IQ_PASSWORD!;

if (!IQ_EMAIL || !IQ_PASSWORD) {
  console.error("Set IQ_EMAIL and IQ_PASSWORD in .env");
  process.exit(1);
}

function writeFixture(name: string, data: unknown) {
  const path = join(FIXTURES_DIR, name);
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${name} (${JSON.stringify(data).length} bytes)`);
}

async function main() {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log("=== Capturing Live Fixtures ===\n");

  // Connect
  console.log("[1] Logging in...");
  const { ssid } = await login(IQ_EMAIL, IQ_PASSWORD);

  console.log("[2] Connecting WebSocket...");
  const ws = new IQWebSocket();
  await ws.connect();

  const protocol = new Protocol(ws);
  console.log("[3] Authenticating...");
  await authenticateWs(protocol, ssid);

  const account = new AccountAPI(protocol, ws);
  const assets = new AssetsAPI(protocol);
  const candles = new CandlesAPI(protocol, ws);
  const trading = new TradingAPI(protocol, ws);
  const subscriptions = new SubscriptionsAPI(protocol, ws);

  // Capture profile
  console.log("\n[4] Capturing fixtures...\n");

  try {
    const profileRes = await protocol.sendMessage("core.get-profile", "1.0", {});
    const profileMsg = profileRes.msg as Record<string, unknown>;
    const profileData = (profileMsg.result && typeof profileMsg.result === "object")
      ? profileMsg.result
      : profileMsg;
    writeFixture("profile.json", profileData);
  } catch (e) {
    console.error("  ✗ profile.json:", (e as Error).message);
  }

  // Capture balances
  try {
    const balancesRes = await protocol.sendMessage("internal-billing.get-balances", "1.0", {});
    const balancesMsg = balancesRes.msg as Record<string, unknown>;
    const balancesData = balancesMsg.result || balancesMsg;
    const arr = Array.isArray(balancesData) ? balancesData : Object.values(balancesData as Record<string, unknown>);
    writeFixture("balances.json", arr);
  } catch (e) {
    console.error("  ✗ balances.json:", (e as Error).message);
  }

  // Capture initialization data (subset — first 3 actives from turbo)
  try {
    const initRes = await protocol.sendMessage("get-initialization-data", "4.0", {});
    const initData = initRes.msg as Record<string, unknown>;

    // Save full structure keys for reference, but only a few actives to keep it small
    const turbo = initData.turbo as Record<string, unknown> | undefined;
    const binary = initData.binary as Record<string, unknown> | undefined;
    const actives = (turbo?.actives || binary?.actives || initData.actives) as Record<string, unknown> | undefined;

    if (actives) {
      const entries = Object.entries(actives);
      const subset: Record<string, unknown> = {};
      // Pick first 3 actives
      for (const [id, active] of entries.slice(0, 3)) {
        subset[id] = active;
      }
      const subsetData: Record<string, unknown> = {};
      if (turbo) {
        subsetData.turbo = { actives: subset };
      } else if (binary) {
        subsetData.binary = { actives: subset };
      } else {
        subsetData.actives = subset;
      }
      writeFixture("initialization-data.json", subsetData);

      // Also save a single raw active for detailed inspection
      const firstEntry = entries[0];
      if (firstEntry) {
        writeFixture("raw-active-sample.json", { id: firstEntry[0], data: firstEntry[1] });
      }
    }
  } catch (e) {
    console.error("  ✗ initialization-data.json:", (e as Error).message);
  }

  // Capture candles — subscribe and wait for a few
  try {
    const capturedCandles: unknown[] = [];
    await new Promise<void>((resolve) => {
      candles.subscribeCandles(76, 1, (candle) => {
        capturedCandles.push(candle);
        console.log(`  [candle] #${capturedCandles.length} captured`);
        if (capturedCandles.length >= 3) {
          candles.unsubscribeCandles(76, 1);
          resolve();
        }
      });

      // Timeout after 15s
      setTimeout(() => {
        candles.unsubscribeCandles(76, 1);
        resolve();
      }, 15000);
    });

    if (capturedCandles.length > 0) {
      writeFixture("candle-generated.json", capturedCandles[0]);
      if (capturedCandles.length > 1) {
        writeFixture("candles-batch.json", capturedCandles);
      }
    } else {
      console.error("  ✗ candle-generated.json: no candles received in 15s");
    }
  } catch (e) {
    console.error("  ✗ candle-generated.json:", (e as Error).message);
  }

  // Capture position-changed — subscribe and listen
  // We also capture the raw message envelope for positions
  try {
    const capturedPositions: unknown[] = [];
    const demoBalance = await account.getDemoBalance();
    const profile = await account.getProfile();

    // Listen for raw position-changed messages
    ws.on("portfolio.position-changed", (msg) => {
      capturedPositions.push(msg.msg);
      console.log(`  [position] captured (status: ${(msg.msg as any)?.status})`);
    });

    trading.subscribePositions(profile.user_id, demoBalance.id, () => {});

    // Wait 5s to see if there are any open/closing positions
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (capturedPositions.length > 0) {
      writeFixture("position-changed.json", capturedPositions);
    } else {
      console.log("  - position-changed.json: no position events (normal if no trades active)");
    }
  } catch (e) {
    console.error("  ✗ position-changed.json:", (e as Error).message);
  }

  // Capture portfolio positions (query)
  try {
    const demoBalance = await account.getDemoBalance();
    const positionsRes = await protocol.sendMessage("portfolio.get-positions", "4.0", {
      user_balance_id: demoBalance.id,
      instrument_types: ["blitz-option"],
    });
    writeFixture("get-positions-response.json", positionsRes.msg);
  } catch (e) {
    console.error("  ✗ get-positions-response.json:", (e as Error).message);
  }

  // Capture history positions
  try {
    const demoBalance = await account.getDemoBalance();
    const historyRes = await protocol.sendMessage("portfolio.get-history-positions", "1.0", {
      user_balance_id: demoBalance.id,
      instrument_types: ["blitz-option"],
      limit: 5,
      offset: 0,
    });
    writeFixture("history-positions-response.json", historyRes.msg);
  } catch (e) {
    console.error("  ✗ history-positions-response.json:", (e as Error).message);
  }

  // Capture traders-mood (RPC response)
  try {
    const moodRes = await protocol.sendMessage("get-traders-mood", "1.0", {
      asset_id: 76,
      instrument: "turbo-option",
    });
    writeFixture("traders-mood.json", moodRes.msg);
  } catch (e) {
    console.error("  ✗ traders-mood.json:", (e as Error).message);
  }

  // Capture traders-mood-changed (subscription push)
  try {
    const capturedMoods: unknown[] = [];
    ws.on("traders-mood-changed", (msg) => {
      capturedMoods.push(msg.msg);
      console.log(`  [mood] captured #${capturedMoods.length}`);
    });

    subscriptions.subscribeTradersMood(76, () => {});

    // Wait 10s for mood updates
    await new Promise(resolve => setTimeout(resolve, 10000));

    if (capturedMoods.length > 0) {
      writeFixture("traders-mood-changed.json", capturedMoods[0]);
    } else {
      console.log("  - traders-mood-changed.json: no mood events in 10s");
    }
  } catch (e) {
    console.error("  ✗ traders-mood-changed.json:", (e as Error).message);
  }

  // Capture balance-changed (subscribe and wait)
  try {
    const capturedBalances: unknown[] = [];
    account.subscribeBalanceChanged((data) => {
      capturedBalances.push(data);
      console.log(`  [balance-changed] captured (amount: ${data.current_balance.amount})`);
    });

    // Wait 5s to see if any balance changes happen
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (capturedBalances.length > 0) {
      writeFixture("balance-changed.json", capturedBalances[0]);
    } else {
      console.log("  - balance-changed.json: no balance events (place a trade to trigger)");
    }
  } catch (e) {
    console.error("  ✗ balance-changed.json:", (e as Error).message);
  }

  console.log("\n=== Done ===");
  ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
