# IQ Option WebSocket Protocol Reference

Reverse-engineered from live WebSocket capture of the IQ Option web traderoom (February 2026).

---

## 1. Transport

| Property | Value |
|---|---|
| URL | `wss://ws.iqoption.com/echo/websocket` |
| Format | Plain JSON text frames |
| Auth | SSID token from HTTP login, then WS `authenticate` message |
| Heartbeat | Server pushes `timeSync` (~every 5-10s). No client ping required. |

---

## 2. Message Envelope

Every message (both directions) uses this shape:

```jsonc
{
  "name": "message_name",         // required — identifies the message type
  "request_id": "string",         // optional — links request↔response
  "local_time": 12345,            // optional — ms since WS connection opened
  "msg": { ... }                  // required — payload (shape varies per name)
}
```

---

## 3. Client → Server: Top-Level Message Types

Only 5 top-level `name` values are ever sent client→server:

| # | `name` | Purpose | Notes |
|---|---|---|---|
| 1 | `authenticate` | Auth the WS connection | First message after open |
| 2 | `sendMessage` | RPC wrapper | `msg` contains `{ name, version, body }` |
| 3 | `setOptions` | Connection config | Fire-and-forget |
| 4 | `subscribeMessage` | Subscribe to push events | `msg` contains `{ name, params: { routingFilters } }` |
| 5 | `unsubscribeMessage` | Unsubscribe from push events | Same shape as subscribeMessage |

---

## 4. `sendMessage` RPC Catalog

### 4.1 Core & Account

| RPC Name | Version | Body Params | Response Name | Impl? | Priority |
|---|---|---|---|---|---|
| `core.get-profile` | 1.0 | `{}` | `profile` | YES | - |
| `get-user-profile-client` | ? | `{}` | `user-profile-client` | no | LOW |
| `get-user-settings` | 1.0, 2.0 | `{}` | `user-settings` | no | MED |
| `set-user-settings` | ? | `{...}` | `set-user-settings-reply` | no | LOW |
| `update-user-availability` | ? | `{...}` | `result` | no | LOW |

### 4.2 Billing & Balances

| RPC Name | Version | Body Params | Response Name | Impl? | Priority |
|---|---|---|---|---|---|
| `internal-billing.get-balances` | 1.0 | `{ types_ids: [1,4,2], tournaments_statuses_ids: [3,2] }` | `balances` | YES | - |

### 4.3 Assets & Market Data

| RPC Name | Version | Body Params | Response Name | Impl? | Priority |
|---|---|---|---|---|---|
| `get-initialization-data` | 4.0 | `{}` | `initialization-data` | YES | - |
| `get-active` | 1.0 | `{ active_id }` | `active` | YES | - |
| `get-actives-index` | ? | `{}` | `actives-index`? | no | MED |
| `get-candles` | 2.0 | `{ active_id, size, from_id, to_id, split_normalization?, only_closed? }` | `candles` | YES | - |
| `get-first-candles` | 1.0 | `{ active_id, split_normalization? }` | `first-candles`? | no | **HIGH** |
| `get-traders-mood` | 1.0 | `{ asset_id, instrument }` | `traders-mood` | YES | - |
| `get-currency` | 5.0 | `{...}` | `currency` | no | LOW |
| `get-currency-list` | ? | `{}` | `currency-list` | no | LOW |
| `get-currencies-list` | ? | `{}` | `currencies-list`? | no | LOW |

### 4.4 Trading — Binary / Blitz Options

| RPC Name | Version | Body Params | Response Name | Impl? | Priority |
|---|---|---|---|---|---|
| `binary-options.open-option` | 2.0 | See [Section 7.1](#71-trade-placement-payload) | `option` | YES | - |

### 4.5 Portfolio

| RPC Name | Version | Body Params | Response Name | Impl? | Priority |
|---|---|---|---|---|---|
| `portfolio.get-positions` | 4.0 | `{ offset, limit, user_balance_id, instrument_types[] }` | `positions` | YES | - |
| `portfolio.get-orders` | 2.0 | `{ user_balance_id, kind: "deferred", instrument_types[] }` | `orders` | YES | - |
| `portfolio.get-history-positions` | 1.0 | `{ user_balance_id, instrument_types[], limit, offset }` | `history-positions` | YES | - |

### 4.6 Marginal Trading (CFD / Forex / Crypto)

| RPC Name | Version | Response Name | Impl? | Priority |
|---|---|---|---|---|
| `marginal-portfolio.get-marginal-balance` | 1.0 | `marginal-balance` | no | LOW |
| `marginal-portfolio.subscribe-balance-changed` | 1.0 | `result` | no | LOW |
| `marginal-cfd-instruments.get-instruments-list` | ? | `instruments-list` | no | LOW |
| `marginal-cfd-instruments.get-overnight-fee` | ? | ? | no | LOW |
| `marginal-cfd-instruments.get-underlying-list` | ? | ? | no | LOW |
| `marginal-forex-instruments.get-instruments-list` | ? | ? | no | LOW |
| `marginal-forex-instruments.get-overnight-fee` | ? | ? | no | LOW |
| `marginal-forex-instruments.get-underlying-list` | ? | ? | no | LOW |
| `marginal-crypto-instruments.get-overnight-fee` | ? | ? | no | LOW |
| `marginal-crypto-instruments.get-underlying-list` | ? | ? | no | LOW |

### 4.7 Digital Options

| RPC Name | Version | Response Name | Impl? | Priority |
|---|---|---|---|---|
| `digital-option-instruments.get-underlying-list` | ? | ? | no | LOW |

### 4.8 Trading Settings & Tools

| RPC Name | Version | Response Name | Impl? | Priority |
|---|---|---|---|---|
| `trading-settings.get-trading-group-params` | ? | ? | no | MED |
| `tech-instruments.get-script-indicators` | ? | ? | no | LOW |
| `tech-instruments.get-standard-library` | ? | ? | no | LOW |
| `tech-instruments.get-templates` | ? | ? | no | LOW |

### 4.9 Promo / Bonuses / Cashback

| RPC Name | Version | Response Name | Impl? | Priority |
|---|---|---|---|---|
| `promo-codes.get-traderoom-promo-codes` | 2.0 | `traderoom-promo-codes` | no | SKIP |
| `promo-codes.get-active-promo-codes` | ? | `active-promo-codes` | no | SKIP |
| `promo-codes.get-available-promo-codes` | ? | `available-promo-codes` | no | SKIP |
| `promo-codes.get-used-promo-codes` | ? | `used-promo-codes` | no | SKIP |
| `deposit-bonuses.get-bonus` | ? | `bonus` | no | SKIP |
| `deposit-bonuses.get-presets` | ? | `presets` | no | SKIP |
| `cashback.get-option-insurance` | ? | `option-insurance` | no | LOW |

### 4.10 Support / Verification / Misc

| RPC Name | Version | Response Name | Impl? | Priority |
|---|---|---|---|---|
| `get-verification-init-data` | ? | `verification-init-data` | no | SKIP |
| `get-customer-steps` | ? | `customer-steps` | no | SKIP |
| `chat.*` (6 methods) | ? | various | no | SKIP |
| `get-additional-blocks` | 1.0 | `additional-blocks` | no | SKIP |
| `get-alerts` | ? | `alerts` | no | SKIP |
| `get-forget-user-status` | 1.0 | `forget-user-status` | no | SKIP |
| `get-leaderboard-position` | ? | `leaderboard-position` | no | SKIP |
| `get-popups` | ? | `popups` | no | SKIP |
| `get-profitable-countries` | ? | ? | no | SKIP |
| `get-faq` | ? | ? | no | SKIP |
| `get-features` | ? | ? | no | SKIP |
| `get-feed-languages` | ? | ? | no | SKIP |
| `get-video-categories` | ? | ? | no | SKIP |
| `get-video-tags` | ? | `video-tags` | no | SKIP |
| `resources.get-resources` | 2.0 | `resources` | no | SKIP |
| `user-activity.get-trading-volume` | ? | `trading-volume` | no | LOW |

---

## 5. Subscription Catalog (`subscribeMessage`)

### 5.1 Subscription Envelope

```jsonc
{
  "name": "subscribeMessage",
  "request_id": "s_212",          // convention: "s_" prefix for subs
  "local_time": 8392,
  "msg": {
    "name": "event-name",
    "version": "1.0",             // optional, not all subs use version
    "params": {
      "routingFilters": { ... }   // optional, scopes the subscription
    }
  }
}
```

### 5.2 Subscription Matrix

| Subscription Name | Version | Routing Filters | Push Event Name | Impl? | Priority |
|---|---|---|---|---|---|
| `candle-generated` | - | `{ active_id, size }` | `candle-generated` | YES | - |
| `portfolio.position-changed` | 3.0 | `{ user_id, user_balance_id, instrument_type }` | `portfolio.position-changed` | YES | - |
| `portfolio.order-changed` | 2.0 | `{ user_id, instrument_type }` | `portfolio.order-changed` | YES | - |
| `traders-mood-changed` | - | `{ asset_id, instrument_type }` | `traders-mood-changed` | YES | - |
| `profile-changed` | 1.0 | `{}` | `profile-changed` | no | LOW |
| `balance-changed` | 1.0 | `{}` | `balance-changed` | YES | - |
| `currency-updated` | 5.0 | `{ name: "USD" }` | `currency-updated` | no | MED |
| `instruments-list` | ? | `{}` | `instruments-list` | YES | - |
| `active` | ? | `{}` | `active` | no | MED |
| `forget-user-status-changed` | 1.0 | `{}` | `forget-user-status-changed` | no | SKIP |
| `marginal-portfolio.balance-changed` | 1.0 | `{}` | `marginal-portfolio.balance-changed` | no | LOW |
| `marginal-portfolio.margin-call` | 1.0 | `{}` | `marginal-portfolio.margin-call` | no | LOW |
| `marginal-forex.order-modified` | 1.0 | `{}` | `marginal-forex.order-modified` | no | LOW |
| `marginal-cfd.order-modified` | 1.0 | `{}` | `marginal-cfd.order-modified` | no | LOW |
| `marginal-crypto.order-modified` | 1.0 | `{}` | `marginal-crypto.order-modified` | no | LOW |

---

## 6. Server → Client: Message Catalog

### 6.1 System Messages

| Message Name | Payload Shape | Notes |
|---|---|---|
| `authenticated` | `{ msg: true, client_session_id: "uuid" }` | Auth success |
| `result` | `{ msg: { success: true } }` | Generic ACK for sendMessage/setOptions |
| `front` | `{ msg: "ws01.ws.prod...", session_id: "..." }` | Server identification |
| `timeSync` | `{ msg: 1770899115227 }` | Heartbeat, unix ms |

### 6.2 Account & Balance Responses

| Message Name | Triggered By | Payload Notes |
|---|---|---|
| `profile` | `core.get-profile` | Nested: `msg.result` contains profile fields |
| `balances` | `internal-billing.get-balances` | Array of balance objects |
| `subscription-balance-changed` | balance sub | Balance delta push |
| `user-settings` | `get-user-settings` | Settings object |
| `user-profile-client` | `get-user-profile-client` | Client profile |

### 6.3 Market Data Responses

| Message Name | Triggered By | Payload Notes |
|---|---|---|
| `initialization-data` | `get-initialization-data` | Massive payload: `turbo.actives`, asset configs |
| `active` | `get-active` or `active` sub | Single asset details |
| `candle-generated` | `candle-generated` sub | See [Section 7.2](#72-candle-payload) |
| `candles` | `get-candles` | Historical candle array |
| `traders-mood` | `get-traders-mood` | Sentiment value |
| `traders-mood-changed` | `traders-mood-changed` sub | Sentiment push update |
| `instruments-list` | `instruments-list` sub | Asset list updates |
| `currency` | `get-currency` | Currency data |
| `currency-updated` | `currency-updated` sub | Currency push update |

### 6.4 Trading & Portfolio Responses

| Message Name | Triggered By | Payload Notes |
|---|---|---|
| `option` | `binary-options.open-option` | Trade confirmation. See [Section 7.1](#71-trade-placement-payload) |
| `positions` | `portfolio.get-positions` | `{ positions: [...] }` |
| `orders` | `portfolio.get-orders` | `{ orders: [...] }` |
| `history-positions` | `portfolio.get-history-positions` | `{ positions: [...] }` |
| `position-changed` | `portfolio.position-changed` sub | See [Section 7.3](#73-position-changed-lifecycle). Note: push event name is `position-changed` (no `portfolio.` prefix) |
| `portfolio.order-changed` | `portfolio.order-changed` sub | Order status push |
| `balance-changed` | `balance-changed` sub | `{ current_balance: { id, amount, currency, type, ... } }` |

---

## 7. Key Payload References

### 7.1 Trade Placement Payload

**Request** (`binary-options.open-option` v2.0):
```jsonc
{
  "user_balance_id": 1090667707,   // demo balance ID
  "active_id": 1938,               // asset
  "option_type_id": 12,            // 12 = blitz option
  "direction": "call",             // "call" | "put"
  "expired": 1770899424,           // expiration unix timestamp (server_time + expiration_size)
  "refund_value": 0,
  "price": 100.0,                  // bet amount
  "value": 292196775,              // current_price * 1_000_000 (integer)
  "profit_percent": 89,            // payout percentage (100 - commission)
  "expiration_size": 30            // seconds
}
```

**Response** (name: `option`, status: `2000`):
```jsonc
{
  "user_id": 141527657,
  "id": 13607084149,               // option ID
  "price": 100,
  "exp": 1770899424,
  "created": 1770899394,
  "type": "blitz",
  "act": 1938,
  "direction": "call",
  "value": 292.146065,             // open price (float)
  "profit_income": 189,            // total return on win
  "profit_return": 0,
  "rollover_params": { "amount_multiplier": 2, "max_count": 1, "offset": 0, "deadtime": 7 }
}
```

**Error** (status: `4117`):
```jsonc
{
  "message": "The option has not been purchased because of the profit rate change.",
  "result": {
    "actual_commission": { "active_id": 76, "commission": 14, "option_type": 12 }
  }
}
```

### 7.2 Candle Payload

**Subscription** (client→server):
```jsonc
{
  "name": "subscribeMessage",
  "msg": {
    "name": "candle-generated",
    "params": {
      "routingFilters": { "active_id": 2276, "size": 60 }
    }
  }
}
```

**Push event** (server→client):
```jsonc
{
  "name": "candle-generated",
  "microserviceName": "quotes",
  "msg": {
    "active_id": 2276,
    "size": 60,
    "at": 1770899119000000000,      // tick timestamp (nanoseconds)
    "from": 1770899100,             // candle start (unix seconds)
    "to": 1770899160,               // candle end (unix seconds)
    "min_at": 1770899100,           // timestamp of min price
    "max_at": 1770899114,           // timestamp of max price
    "id": 501774,                   // sequential candle ID
    "open": 0.246675,
    "close": 0.246815,
    "min": 0.246675,                // NOTE: "min" not "low"
    "max": 0.246975,                // NOTE: "max" not "high"
    "ask": 0.24682,
    "bid": 0.24681,
    "volume": 0,
    "phase": "T"                    // "T" = trading
  }
}
```

### 7.3 Position-Changed Lifecycle

**Opened:**
```jsonc
{
  "name": "portfolio.position-changed",
  "msg": {
    "id": 13607084149,
    "instrument_type": "blitz-option",
    "instrument_id": "blitz_AAPL_OTC",
    "active_id": 1938,
    "direction": "call",
    "status": "open",
    "result": "opened",
    "investment": 100,
    "pnl": null,
    "close_profit": null,
    "profit_amount": null,
    "close_reason": null,
    "open_time": 1770899394,
    "expiration_time": 1770899424,
    "expiration_size": 30,
    "expiration_value": null
  }
}
```

**Closed (win):**
```jsonc
{ "status": "closed", "result": "win", "close_reason": "win",
  "pnl": 89, "close_profit": 189, "profit_amount": 89,
  "expiration_value": 292.500000 }
```

**Closed (loss):**
```jsonc
{ "status": "closed", "result": "loose", "close_reason": "loose",
  "pnl": -100, "close_profit": 0, "profit_amount": -100 }
```

> Note: server spells it `"loose"`, not `"lose"`.

---

## 8. Protocol Constants

| Constant | Value | Notes |
|---|---|---|
| `option_type_id` | `12` | Blitz option |
| Balance type: real | `1` | |
| Balance type: demo | `4` | |
| Balance type: tournament | `2` | |
| Price encoding | `price * 1_000_000` | Integer in `value` field |
| `status` on success | `2000` | In trade response |
| `status` on error | `4117` | Commission mismatch |
| `phase: "T"` | Trading | In candle data |

---

## 9. Implementation Status Matrix

### 9.1 Coverage Summary

| Category | Captured | Implemented | Coverage |
|---|---|---|---|
| Top-level message types | 5 | 5 | **100%** |
| sendMessage RPCs (trading-relevant) | ~18 | 11 | **61%** |
| sendMessage RPCs (total incl. UI/chat/promo) | 58 | 11 | 19% |
| Subscriptions (trading-relevant) | ~8 | 6 | **75%** |
| Subscriptions (total) | ~15 | 6 | 40% |
| Server→Client handlers | ~42 | 8 | 19% |
| RESPONSE_NAME_MAP entries | ~18 needed | 11 | 61% |

### 9.2 What's Missing (Trading-Relevant Only)

| # | Item | Type | Priority | Why |
|---|---|---|---|---|
| 1 | `get-first-candles` | RPC | **HIGH** | Cold start: get latest candles without guessing ID ranges |
| 2 | ~~`balance-changed`~~ | ~~Sub~~ | ~~**HIGH**~~ | Done — real-time balance updates via `subscribeBalanceChanged()` |
| 3 | ~~`subscription-balance-changed`~~ | ~~Event~~ | ~~**HIGH**~~ | Same as balance-changed (^) |
| 4 | `get-actives-index` | RPC | MED | Canonical asset name lookup |
| 5 | `currency-updated` | Sub | MED | Spread changes affect fill quality |
| 6 | ~~`instruments-list`~~ | ~~Sub~~ | ~~MED~~ | Done — `subscribeInstrumentsList()` |
| 7 | `get-user-settings` | RPC | MED | Timezone, preferences |
| 8 | `trading-settings.get-trading-group-params` | RPC | MED | Actual trading limits per group |
| 9 | `user-activity.get-trading-volume` | RPC | LOW | Track volume for analytics |
| 10 | `cashback.get-option-insurance` | RPC | LOW | Refund/insurance mechanics |

### 9.3 Known Protocol Bugs in Current Implementation

| # | Bug | Severity | Location | Description |
|---|---|---|---|---|
| 1 | ~~`pendingByName` race condition~~ | ~~HIGH~~ | `protocol.ts` | **Fixed.** Protocol now uses `request_id`-based resolution. |
| 2 | ~~Candle type mismatch~~ | ~~LOW~~ | `schemas/candles.ts` | **Fixed.** `CandleSchema` transforms `min`/`max` → `low`/`high` aliases. |
| 3 | ~~Missing RESPONSE_NAME_MAP~~ | ~~MED~~ | `protocol.ts` | **Fixed.** No name map needed — resolution is `request_id`-based. |
| 4 | `request_id` format | LOW | `protocol.ts` | We use incrementing integers. Captured traffic uses `"s_212"` for subs, timestamp-based for auth. Likely cosmetic. |
| 5 | `setOptions` has no ACK tracking | LOW | `account.ts` | Uses `fire()` — if server rejects, we never know. |

---

## 10. Signals Available for Bot Consumption

Summary of all data streams a strategy can consume:

| Signal | Source | Frequency | Currently Available? |
|---|---|---|---|
| OHLCV candles (any timeframe) | `candle-generated` sub | Per-tick within candle window | YES |
| Trader sentiment (buy/sell ratio) | `traders-mood-changed` sub | Push | YES (wired, not consumed) |
| Trade result (win/loss/pnl) | `portfolio.position-changed` sub | Per trade close | YES (wired, not consumed by strategy) |
| Open positions | `portfolio.get-positions` RPC | On-demand | YES |
| Trade history | `portfolio.get-history-positions` RPC | On-demand | YES |
| Historical candles | `get-candles` RPC | On-demand | YES |
| Current balance | `balance-changed` sub + `get-balances` RPC | Real-time push + on-demand | YES |
| Asset payout/commission | `initialization-data` | On connect | YES (static) |
| Bid/ask spread | Inside `candle-generated` payload | Per-tick | YES (parsed: ask/bid fields) |
| Asset open/closed status | `instruments-list` sub | Push | YES (wired, not consumed) |
| Multi-timeframe candles | Multiple `candle-generated` subs | Per-tick | Possible but not wired |
| Candle phase (trading/auction) | `phase` field in candle | Per-tick | YES (in payload, not parsed) |
| Server time | `timeSync` | ~5-10s | YES |

---

## 11. Unknowns / Not Captured

These may exist in the protocol but were never observed during the capture session:

| Item | Likelihood | Notes |
|---|---|---|
| Tick-by-tick quote stream | Possible | Candles appear to be the primary price feed. 1s candles give sub-second ticks. |
| Commission-changed event | Unlikely | Commission appears static per asset, set in init data |
| Instrument suspend/resume push | Likely | `instruments-list` sub probably covers this, not tested |
| ~~Balance-changed push~~ | Confirmed | Event name is `balance-changed`, payload: `{ current_balance: { id, amount, ... } }` |
| Order fill notifications | Unknown | May come via `portfolio.order-changed` |
| Rollover/extend option | Possible | `rollover_params` in trade response hints at this |
| Other `setOptions` keys | Likely | Only `sendResults` was observed |
