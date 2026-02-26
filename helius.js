/**
 * helius.js — Real-time Solana data feed via Helius WebSocket
 * Phase 2: live transaction data → drives particle system in real time
 *
 * Maps on-chain events to visual parameters:
 *   - Transaction volume → particle density burst
 *   - Whale transfers (>1000 SOL) → gravity well effect
 *   - MEV/sandwich attacks → color distortion flash
 *   - Token mints → new node spawn
 */

const HELIUS_WS = 'wss://mainnet.helius-rpc.com/?api-key=';

// Visual event types emitted to particle system
export const EventType = {
  TRANSACTION:  'tx',       // normal tx — small particle burst
  WHALE:        'whale',    // large transfer — gravity well
  MEV:          'mev',      // sandwich/arb — distortion flash
  MINT:         'mint',     // token mint — new node spawn
  BURN:         'burn',     // token burn — node collapse
};

export class HeliusLiveFeed {
  constructor(apiKey, onEvent) {
    this.apiKey = apiKey;
    this.onEvent = onEvent;
    this.ws = null;
    this.connected = false;
    this.demoActive = false;  // tracks if demo loop is running
    this.reconnectDelay = 2000;
    this.eventCount = 0;
    this.lastEventMs = 0;
  }

  connect() {
    if (!this.apiKey || this.apiKey === 'demo') {
      console.log('[helius] No API key — using demo mode (simulated events)');
      this._startDemoMode();
      return;
    }

    try {
      this.ws = new WebSocket(HELIUS_WS + this.apiKey);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('[helius] Connected to Helius WebSocket');

        // Subscribe to all transactions on mainnet
        this.ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: ['all', { commitment: 'confirmed' }],
        }));
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          this._handleMessage(data);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('[helius] Disconnected — reconnecting in', this.reconnectDelay, 'ms');
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      };

      this.ws.onerror = () => {
        console.warn('[helius] WebSocket error — falling back to demo mode');
        this.ws.close();
        if (!this.demoActive) this._startDemoMode();
      };
    } catch (e) {
      console.warn('[helius] WebSocket unavailable — demo mode');
      this._startDemoMode();
    }
  }

  _handleMessage(data) {
    if (!data?.params?.result?.value) return;

    const logs = data.params.result.value.logs || [];
    const sig = data.params.result.value.signature || '';

    // Detect event type from logs
    let type = EventType.TRANSACTION;
    let magnitude = 0.3 + Math.random() * 0.4; // default: small

    if (logs.some(l => l.includes('Instruction: Transfer'))) {
      // Check for large transfers (whale detection — heuristic from log patterns)
      if (logs.some(l => l.includes('1000000000'))) { // >1 SOL in lamports * 1000
        type = EventType.WHALE;
        magnitude = 0.8 + Math.random() * 0.2;
      }
    }

    if (logs.some(l => l.includes('Program log: Instruction: Swap') || l.includes('ArbInstruction'))) {
      type = EventType.MEV;
      magnitude = 0.6 + Math.random() * 0.4;
    }

    if (logs.some(l => l.includes('Instruction: MintTo') || l.includes('InitializeMint'))) {
      type = EventType.MINT;
      magnitude = 0.5;
    }

    if (logs.some(l => l.includes('Instruction: Burn'))) {
      type = EventType.BURN;
      magnitude = 0.5;
    }

    this.eventCount++;
    this.lastEventMs = Date.now();

    this.onEvent({
      type,
      magnitude,
      sig: sig.slice(0, 8),
      timestamp: Date.now(),
    });
  }

  _startDemoMode() {
    if (this.demoActive) return; // prevent double-start
    this.demoActive = true;
    // Simulate realistic Solana tx cadence (~2500 tps, scaled down)
    const scheduleNext = () => {
      const delay = 80 + Math.random() * 120; // ~8-12 events/sec
      setTimeout(() => {
        if (!this.connected && this.demoActive) {
          const rand = Math.random();
          let type, magnitude;

          if (rand < 0.005) {
            type = EventType.WHALE;
            magnitude = 0.85 + Math.random() * 0.15;
          } else if (rand < 0.025) {
            type = EventType.MEV;
            magnitude = 0.6 + Math.random() * 0.3;
          } else if (rand < 0.04) {
            type = EventType.MINT;
            magnitude = 0.5;
          } else if (rand < 0.05) {
            type = EventType.BURN;
            magnitude = 0.45;
          } else {
            type = EventType.TRANSACTION;
            magnitude = 0.2 + Math.random() * 0.5;
          }

          this.eventCount++;
          this.lastEventMs = Date.now();
          this.onEvent({ type, magnitude, sig: 'demo', timestamp: Date.now() });
          scheduleNext();
        } else if (this.connected) {
          this.demoActive = false; // real connection took over; stop demo loop
        }
      }, delay);
    };

    scheduleNext();
    console.log('[helius] Demo mode active — simulating Solana tx stream');
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.connected = false;
  }

  getStats() {
    return {
      connected: this.connected,
      eventCount: this.eventCount,
      lastEventMs: this.lastEventMs,
      msSinceLastEvent: Date.now() - this.lastEventMs,
    };
  }
}
