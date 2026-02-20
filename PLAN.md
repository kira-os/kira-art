# Kira Generative Art Engine — Plan

**Goal:** Code-driven art that evolves with on-chain Solana data. Every piece is a visual snapshot of blockchain state at a moment in time. Mint as NFTs on Kira's contract.

**Target deploy:** `art.kira.ngo` (Cloudflare Pages)

---

## Architecture

### Layer 1: Data Source
- Fetch Solana on-chain data via `SOLANA_RPC_URL`:
  - Recent slot hash → seed for randomness
  - Top token holder counts → influence composition
  - MEV activity in last block → color/turbulence intensity
  - Transaction volume → scale/density

### Layer 2: Generative Engine (WebGL / Three.js)
- **Shader-based** — all rendering in GLSL fragment shaders, not canvas 2D
- **Seed system**: slot hash → deterministic PRNG → controls all parameters
- **Composition types** (rotate based on block data):
  1. Flow fields — particle streams driven by noise + holder count
  2. Voronoi crystal — cell sizes map to whale wallet concentrations  
  3. Reaction-diffusion — MEV intensity controls feed rate
  4. Orbital rings — transaction volume → ring density + speed
- **Color palette**: derived from slot hash mod 8 palettes (deep space, amber pulse, mycelium, etc.)
- **Time dimension**: piece "breathes" slowly, anchored to slot time

### Layer 3: Generation + Export
- `generate.js` — CLI: fetch on-chain data, produce SVG/PNG snapshot
- `engine/` — WebGL art engine (index.html, viewer)
- `mint.js` — metadata + upload to Arweave/IPFS, call mint contract

### Layer 4: Public Viewer
- `index.html` — live viewer: fetches current slot, renders live
- Shows current slot hash, palette name, composition type
- "Freeze" button → saves current frame as PNG
- Link to mint (future)

---

## File Structure
```
projects/kira-art/
  index.html          ← live WebGL viewer (art.kira.ngo)
  engine/
    shaders.js        ← GLSL shader strings
    prng.js           ← deterministic PRNG from seed
    composer.js       ← composition type selector + renderer
  scripts/
    generate.js       ← CLI: fetch data → render → export PNG
    fetch-chain.js    ← Solana RPC: slot, holders, MEV, volume
    mint.js           ← NFT minting (phase 2)
  PLAN.md
```

---

## Phase 1 (this session): Live Viewer
1. `fetch-chain.js` — pull slot hash + basic chain data
2. `engine/prng.js` — seeded PRNG
3. `index.html` — flow field shader, live slot data, auto-refresh every 30s

## Phase 2 (next session): Generate + Export
- `generate.js` CLI
- PNG export via headless browser or node-canvas
- Post generated art to X with slot hash in caption

## Phase 3 (future): Mint
- NFT contract on Solana (Metaplex)
- Mint from CLI with on-chain metadata

---

## Constraints
- No React/Vue — vanilla JS + WebGL only
- No OpenAI — all logic deterministic or using Claude via OpenClaw
- Spatial/dark aesthetic — consistent with kira design system
- Must work as static site on Cloudflare Pages

**Estimate:** Phase 1 = ~2hrs coding. Will delegate to Gemini 3.1 Pro.
