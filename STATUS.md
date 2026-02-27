# Kira Art Engine — Phase 3 Status

**Date:** 2026-02-24  
**Phase:** 3 complete — PNG export composites both WebGL + 2D particle layers

---

## What Works ✅

### Data Flow (fully wired)
```
helius.js (HeliusLiveFeed)
  → onEvent callback
  → handleSolanaEvent() in generative.js
  → window.dispatchEvent('solanaEvent')  [for any global listeners]
  → sys.handleLiveEvent(effect)          [direct call to ParticleSystem]
  → WebGL canvas updates in real-time
```

### generative.js
- `walletToParams(address)` — deterministic art params from wallet address (tested ✅)
- `ParticleSystem` — 2D Canvas particle renderer with:
  - Node-based flow fields (orbit around luminescent orbs)
  - Particle trails with alpha fade
  - Live event effects: whale gravity wells, mint spawns, burn culls, pulse rings
  - `handleLiveEvent(effect)` correctly branches on `effect.type` (bug fixed: type was missing)
- `handleSolanaEvent(event)` — maps tx type → visual effect object (now includes `type` field)

### helius.js  
- `HeliusLiveFeed` class:
  - Connects to `wss://mainnet.helius-rpc.com/?api-key=<KEY>` via WebSocket
  - On error/unavailable: auto-falls back to demo mode (~8–12 events/sec simulated)
  - Demo mode stops automatically if a real connection succeeds (bug fixed: was leaking)
  - Parses `logsSubscribe` messages: detects whale transfers, MEV swaps, mints, burns
  - `getStats()` for UI monitoring

### index.html
- Dual-layer canvas: WebGL flow field (Layer 1) + 2D particle overlay (Layer 2)
- Imports both `generative.js` and `helius.js` as ES modules ✅
- Reads API key from `config.js` (generated, gitignored) with graceful fallback to demo
- Live feed status indicator in top-left UI (`feed: demo/live/reconnecting · N events`)
- Wallet input → re-seeds particle system deterministically
- Freeze button → exports PNG snapshot

### API Key Handling
- `gen-config.js` script reads `HELIUS_API_KEY` from `/workspace/kira/.env`
  - Falls back to extracting from `SOLANA_RPC_URL` if dedicated key not set
  - Current key: extracted from `SOLANA_RPC_URL` (devnet endpoint)
- `config.js` is gitignored (never committed with secrets)
- Browser gracefully falls back to demo mode if `config.js` is absent

---

## Bugs Fixed in Phase 2

1. **`effect.type` missing** — `handleSolanaEvent` was returning an effect without `type`,
   so `handleLiveEvent`'s whale/mint/burn branches were never triggered. Fixed with `effect.type = type`.

2. **Demo mode leak** — `_startDemoMode` loop used `!this.connected` but the flag was never
   set to `true` in demo mode, creating a zombie loop if `connect()` was called again.
   Fixed with `demoActive` flag and proper stop condition.

3. **Effect object mutation** — `handleSolanaEvent` was mutating a shared effects map entry.
   Fixed with `{ ...effects[type] }` spread copy before assignment.

---

## Files

| File | Status | Notes |
|------|--------|-------|
| `generative.js` | ✅ Updated | Added `type` to effect, spread-copy fix |
| `helius.js` | ✅ Updated | `demoActive` flag, loop stop fix |
| `index.html` | ✅ Updated | Imports config.js, feed status UI |
| `config.js` | ✅ Generated | Gitignored, contains API key |
| `gen-config.js` | ✅ New | Generates config.js from .env |
| `.gitignore` | ✅ New | Protects config.js from commits |
| `mint.js` | ✅ New | Metaplex Umi integration for NFT minting |
| `wallet-adapter.js` | ✅ New | React wallet adapter (Phantom/Solflare) with MintButton |

---

## Phase 3: What's Left

1. **Mainnet API key** — Current key is from a devnet endpoint. Get a dedicated mainnet
   Helius API key and update `.env` with `HELIUS_API_KEY=<mainnet-key>` for live data.

2. **WebSocket subscription tuning** — Currently subscribes to `logsSubscribe: 'all'`,
   which is extremely high volume. Consider filtering to specific program IDs
   (e.g., Raydium, Orca, Metaplex) to reduce noise and API cost.

3. **NFT minting** — `mint.js` not yet implemented. Will use Metaplex + Arweave/IPFS
   for metadata. "Freeze" button should trigger mint flow.

4. **Wallet integration** — Currently accepts any address string. Phase 3 should add
   Phantom/Solflare wallet adapter so users mint art seeded from their own wallet.

5. **PNG export quality** — ✅ The freeze button now composites both WebGL flow field
   (Layer 1) and 2D particle overlay (Layer 2) into a single PNG export.

6. **Cloudflare Pages deploy** — `gen-config.js` needs to run as a build step in
   `wrangler.toml` / Pages CI, pulling `HELIUS_API_KEY` from CF environment secrets.

---

## Testing

```bash
# Generate config.js from .env
node gen-config.js

# Test data flow (headless)
node --input-type=module << 'EOF'
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(t,o){ this.detail=o?.detail; } };
globalThis.WebSocket = class { constructor(url){ setTimeout(()=>this.onerror&&this.onerror(),10); } close(){} };
import { handleSolanaEvent, walletToParams } from './generative.js';
import { HeliusLiveFeed } from './helius.js';
const e = handleSolanaEvent({ type:'whale', magnitude:0.9, sig:'test', timestamp:Date.now() });
console.assert(e.type === 'whale');
console.log('PASS');
EOF

# Serve locally
npx serve . -p 3333
# Open http://localhost:3333
```

---

## Phase 4 Roadmap (Next)

**Target:** NFT minting + wallet integration

### 4.1 Metaplex Integration
- [x] Install `@metaplex-foundation/js` and `@solana/web3.js`
- [x] Create `mint.js` module with Metaplex Umi configuration
- [x] Implement metadata upload to Arweave (via Irys/Bundlr)
- [x] Generate metadata JSON with artwork traits derived from `walletToParams()`
- [ ] Test mint on devnet

**Status:** mint.js created with Umi configuration for devnet. Ready for wallet adapter integration.

### 4.2 Wallet Adapter
- [x] Add `@solana/wallet-adapter-react` and Phantom/Solflare adapters
- [x] Create `wallet-adapter.js` with WalletConnect, WalletContextProvider, and MintButton components
- [x] Implement wallet balance display and disconnect functionality
- [x] Build MintButton with status feedback and error handling

### 4.3 HTML Integration
- [x] Add React 18 and Solana wallet adapter dependencies via CDN
- [x] Replace wallet input field with React wallet adapter UI
- [x] Mount wallet components in #wallet-root div
- [x] Wire wallet connection to generative art system (updateGenerativeWallet)
- [x] Auto-seed art from connected wallet address on connection
- [ ] Test full wallet flow on devnet
- [ ] Wire MintButton to freeze → mint flow

**Status:** Wallet adapter fully integrated into index.html. Ready for testing.

### 4.3 Production Deployment
- [ ] Get mainnet Helius API key
- [ ] Configure Cloudflare Pages build with `HELIUS_API_KEY` secret
- [ ] Deploy to `art.kira.ngo`
- [ ] Switch Metaplex to mainnet for live minting

**Estimated effort:** 2-3 sessions
