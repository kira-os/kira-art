/**
 * generative.js — Wallet-seeded deterministic particle art
 * Phase 1: input wallet address → unique evolving particle system
 * Visual language: dark-cinematic — transactions as light trails, nodes as luminescent orbs
 */

// Deterministic hash from string → float [0,1]
function hashFloat(str, seed = 0) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (Math.abs(h) % 100000) / 100000;
}

function hashInt(str, seed, max) {
  return Math.floor(hashFloat(str, seed) * max);
}

// Live event handler — called by helius.js when Solana transaction occurs
export function handleSolanaEvent(event) {
  const { type, magnitude, sig, timestamp } = event;
  console.log(`[generative] Solana event: ${type} (${magnitude.toFixed(2)}) ${sig}`);
  
  // Map event type to visual effect
  const effects = {
    tx: { color: '#00ffff', size: 0.3, duration: 800 },      // normal tx — cyan pulse
    whale: { color: '#ff00ff', size: 1.2, duration: 2000 },  // whale — magenta gravity well
    mev: { color: '#ffff00', size: 0.8, duration: 1200 },    // MEV — yellow distortion flash
    mint: { color: '#00ff00', size: 0.6, duration: 1500 },   // mint — green node spawn
    burn: { color: '#ff0000', size: 0.7, duration: 1400 },   // burn — red node collapse
  };

  const effect = { ...(effects[type] || effects.tx) };
  effect.type = type;  // preserve type for handleLiveEvent branching
  effect.magnitude = magnitude;
  effect.timestamp = timestamp;
  effect.sig = sig;

  // Dispatch to particle system (WebGL will pick this up)
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('solanaEvent', { detail: effect }));
  }

  return effect;
}

// Generate deterministic art parameters from a wallet address
export function walletToParams(address) {
  if (!address || address.length < 8) address = 'default_kira_seed';
  const a = address;

  // Node count: 12-48
  const nodeCount = 12 + hashInt(a, 1, 36);

  // Color palette: one of 4 schemes
  const paletteIdx = hashInt(a, 2, 4);
  const palettes = [
    { primary: '#00e5ff', secondary: '#7c6af7', accent: '#ff6b2b' },  // cyan/violet/amber
    { primary: '#00ff88', secondary: '#0066ff', accent: '#ff0088' },  // bioluminescent
    { primary: '#ffcc00', secondary: '#ff4400', accent: '#00ccff' },  // molten
    { primary: '#cc00ff', secondary: '#00ffcc', accent: '#ff6600' },  // deep violet/teal
  ];
  const palette = palettes[paletteIdx];

  // Node positions (normalized 0-1)
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: hashFloat(a + i, 10 + i),
      y: hashFloat(a + i, 20 + i),
      mass: 0.3 + hashFloat(a + i, 30 + i) * 0.7,  // 0.3-1.0
      speed: 0.0002 + hashFloat(a + i, 40 + i) * 0.0008,
      phase: hashFloat(a + i, 50 + i) * Math.PI * 2,
      connections: [],
    });
  }

  // Connect nodes: each connects to 2-4 nearest (by hash distance)
  for (let i = 0; i < nodes.length; i++) {
    const connCount = 2 + hashInt(a + 'conn' + i, i, 3);
    const candidates = nodes.map((n, j) => ({
      j,
      dist: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y),
    })).filter(c => c.j !== i).sort((a, b) => a.dist - b.dist);
    nodes[i].connections = candidates.slice(0, connCount).map(c => c.j);
  }

  // Particle count: 40-120
  const particleCount = 40 + hashInt(a, 3, 80);

  // Flow field turbulence: 0.3-1.0
  const turbulence = 0.3 + hashFloat(a, 4) * 0.7;

  return { nodeCount, palette, nodes, particleCount, turbulence, address, liveEnabled: false };
}

// Particle system class
export class ParticleSystem {
  constructor(canvas, params) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = params;
    this.particles = [];
    this.time = 0;
    this.scaledNodes = [];
    this.liveEffect = null;
    this._initParticles();
  }

  handleLiveEvent(effect) {
    // Pick a random node as epicenter
    const idx = Math.floor(Math.random() * this.params.nodes.length);
    const node = this.params.nodes[idx];
    
    this.liveEffect = {
      ...effect,
      x: node.x,
      y: node.y,
      start: Date.now(),
      duration: effect.duration || 1000,
    };

    // Visual feedback based on event type
    if (effect.type === 'whale') {
      // Gravity well — pull particles toward epicenter
      this.particles.forEach(p => {
        const dx = node.x * this.canvas.width - p.x;
        const dy = node.y * this.canvas.height - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.0005 * effect.magnitude;
          p.vy += dy * 0.0005 * effect.magnitude;
        }
      });
    } else if (effect.type === 'mint') {
      // Spawn new particle
      this.particles.push({
        x: node.x * this.canvas.width,
        y: node.y * this.canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1000,
        maxLife: 1000,
        trail: [],
      });
    } else if (effect.type === 'burn') {
      // Kill nearby particles
      this.particles = this.particles.filter(p => {
        const dx = node.x * this.canvas.width - p.x;
        const dy = node.y * this.canvas.height - p.y;
        return dx * dx + dy * dy > 4000; // outside radius
      });
    }
  }

  _scaleNode(node) {
    return {
      ...node,
      sx: node.x * this.canvas.width,
      sy: node.y * this.canvas.height,
    };
  }

  _initParticles() {
    const { params } = this;
    this.scaledNodes = params.nodes.map(n => this._scaleNode(n));
    this.particles = [];
    for (let i = 0; i < params.particleCount; i++) {
      // Start particles near random nodes
      const homeNode = this.scaledNodes[i % this.scaledNodes.length];
      this.particles.push({
        x: homeNode.sx + (Math.random() - 0.5) * 60,
        y: homeNode.sy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: Math.random(),
        maxLife: 0.6 + Math.random() * 0.4,
        homeNode: i % this.scaledNodes.length,
        trail: [],
      });
    }
  }

  resize() {
    this.scaledNodes = this.params.nodes.map(n => this._scaleNode(n));
  }

  update() {
    this.time += 0.008;
    const { palette, turbulence } = this.params;
    const W = this.canvas.width, H = this.canvas.height;

    for (const p of this.particles) {
      // Attract toward home node
      const home = this.scaledNodes[p.homeNode];
      const dx = home.sx + Math.sin(this.time + home.phase) * 40 - p.x;
      const dy = home.sy + Math.cos(this.time * 0.7 + home.phase) * 40 - p.y;
      const dist = Math.hypot(dx, dy);

      // Flow field noise-like perturbation
      const angle = (p.x * 0.003 + p.y * 0.003 + this.time * 0.3) * turbulence;
      p.vx += dx / Math.max(dist, 1) * 0.04 + Math.cos(angle) * 0.02;
      p.vy += dy / Math.max(dist, 1) * 0.04 + Math.sin(angle) * 0.02;

      // Dampen
      p.vx *= 0.96;
      p.vy *= 0.96;

      p.x += p.vx;
      p.y += p.vy;

      // Save trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 18) p.trail.shift();

      p.life += 0.004;
      if (p.life > p.maxLife || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
        // Respawn near home
        p.x = home.sx + (Math.random() - 0.5) * 80;
        p.y = home.sy + (Math.random() - 0.5) * 80;
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = (Math.random() - 0.5) * 0.4;
        p.life = 0;
        p.trail = [];
      }
    }

    // Drift nodes
    for (const n of this.scaledNodes) {
      n.sx = n.x * W + Math.sin(this.time * n.speed * 200 + n.phase) * 18;
      n.sy = n.y * H + Math.cos(this.time * n.speed * 160 + n.phase) * 18;
    }
  }

  draw() {
    const { ctx, canvas, params, scaledNodes, time } = this;
    const { palette } = params;
    const W = canvas.width, H = canvas.height;

    // Fade trail
    ctx.fillStyle = 'rgba(8, 12, 20, 0.18)';
    ctx.fillRect(0, 0, W, H);

    // Draw connections between nodes
    for (let i = 0; i < scaledNodes.length; i++) {
      const n = scaledNodes[i];
      for (const j of params.nodes[i].connections) {
        const t = scaledNodes[j];
        const pulse = 0.15 + Math.sin(time * 1.2 + i * 0.5) * 0.08;
        ctx.beginPath();
        ctx.moveTo(n.sx, n.sy);
        ctx.lineTo(t.sx, t.sy);
        ctx.strokeStyle = palette.secondary + Math.floor(pulse * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Draw particle trails
    for (const p of this.particles) {
      if (p.trail.length < 2) continue;
      const alpha = (1 - p.life / p.maxLife) * 0.7;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.strokeStyle = palette.primary + Math.floor(alpha * 180).toString(16).padStart(2, '0');
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Draw active live event effects
    if (this.liveEffect && Date.now() - this.liveEffect.start < this.liveEffect.duration) {
      const e = this.liveEffect;
      const progress = (Date.now() - e.start) / e.duration;
      const alpha = 0.8 * (1 - progress);
      const radius = e.size * 80 * (1 - progress * 0.5);
      
      ctx.beginPath();
      ctx.arc(e.x * this.canvas.width, e.y * this.canvas.height, radius, 0, Math.PI * 2);
      ctx.fillStyle = e.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();

      // Distortion effect for MEV events
      if (e.type === 'mev') {
        ctx.save();
        ctx.translate(e.x * this.canvas.width, e.y * this.canvas.height);
        ctx.rotate(progress * Math.PI * 2);
        ctx.scale(1 + progress * 0.3, 1 - progress * 0.2);
        ctx.restore();
      }
    }

    // Draw nodes as luminescent orbs
    for (const n of scaledNodes) {
      const pulse = 0.7 + Math.sin(time * 1.5 + n.phase) * 0.3;
      const r = 3 + n.mass * 8 * pulse;

      // Outer glow
      const grd = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, r * 3);
      grd.addColorStop(0, palette.primary + 'cc');
      grd.addColorStop(0.4, palette.primary + '44');
      grd.addColorStop(1, palette.primary + '00');
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}
