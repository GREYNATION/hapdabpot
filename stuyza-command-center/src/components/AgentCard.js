/**
 * AgentCard.js — Tier-aware version
 * Tier 1: blue glow
 * Tier 2: silver glow + augmented nameplate
 * Tier 3: gold + holographic shimmer effect
 */

import { SkillTreeModal } from './SkillTreeModal.js';

const TIER_GLOW   = { 1: 0x0088ff, 2: 0xc0c0c0, 3: 0xffcc00 };
const TIER_LABELS = { 1: 'T1', 2: 'T2', 3: 'T3' };

export class AgentCard {
  constructor(scene, x, y, agentData) {
    this.scene     = scene;
    this.agentData = agentData;
    const { display_name, agent_id, tier = 1, xp = 0, server_tokens = 0 } = agentData;
    const role    = agentData.role || agent_id;
    const icon    = agentData.icon || '◈';
    const glow    = TIER_GLOW[tier];
    const glowHex = '#' + glow.toString(16).padStart(6, '0');

    // ── Card background ──────────────────────────────────────────────────
    const bg = scene.add.rectangle(x + 240, y + 30, 470, 66, 0x000d08)
      .setStrokeStyle(tier === 3 ? 2 : 1, glow, tier === 3 ? 0.9 : 0.4);
    bg.setInteractive({ useHandCursor: true });

    // ── Tier 3: Holographic shimmer overlay ──────────────────────────────
    if (tier === 3) {
      const shimmer = scene.add.rectangle(x + 240, y + 30, 470, 66, 0xffcc00, 0.05);
      scene.tweens.add({
        targets: shimmer, alpha: 0.12, duration: 1200,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      // Gold particle effect
      for (let i = 0; i < 3; i++) {
        const dot = scene.add.circle(
          x + 20 + Math.random() * 430, y + 8 + Math.random() * 44, 2, 0xffcc00
        );
        scene.tweens.add({
          targets: dot, alpha: 0, x: dot.x + (Math.random() - 0.5) * 40,
          duration: 1500 + Math.random() * 1000, repeat: -1, repeatDelay: Math.random() * 500
        });
      }
    }

    // ── Tier 2: Silver nameplate bar ─────────────────────────────────────
    if (tier >= 2) {
      scene.add.rectangle(x + 240, y + 56, 470, 2, glow, 0.4);
    }

    // ── Pulse dot ────────────────────────────────────────────────────────
    const dot = scene.add.circle(x + 10, y + 30, tier === 3 ? 7 : 5, glow);
    scene.tweens.add({
      targets: dot, alpha: 0.2,
      duration: 600 + Math.random() * 400,
      yoyo: true, repeat: -1
    });

    // ── Icon ──────────────────────────────────────────────────────────────
    scene.add.text(x + 24, y + 30, icon, {
      fontFamily: 'Share Tech Mono', fontSize: tier === 3 ? '20px' : '16px',
      color: glowHex
    }).setOrigin(0.5);

    // ── Name ──────────────────────────────────────────────────────────────
    scene.add.text(x + 42, y + 16, display_name || agent_id, {
      fontFamily: 'Orbitron',
      fontSize: tier >= 2 ? '11px' : '10px',
      color: glowHex
    });

    // ── Role ──────────────────────────────────────────────────────────────
    scene.add.text(x + 42, y + 32, role.toUpperCase(), {
      fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#006633'
    });

    // ── XP bar (mini) ─────────────────────────────────────────────────────
    const xpPct = (xp % 100) / 100;
    scene.add.rectangle(x + 42 + 150, y + 20, 100, 4, 0x001a0d);
    scene.add.rectangle(x + 42 + 100 + xpPct * 50, y + 20, xpPct * 100, 4, glow).setOrigin(1, 0.5);

    // ── Tier badge ────────────────────────────────────────────────────────
    const badgeX = x + 450;
    scene.add.rectangle(badgeX + 7, y + 14, 28, 16, 0x001a0d).setStrokeStyle(1, glow, 0.8);
    scene.add.text(badgeX, y + 14, TIER_LABELS[tier], {
      fontFamily: 'Orbitron', fontSize: '9px', color: glowHex
    }).setOrigin(0.5);

    // ── Token count ───────────────────────────────────────────────────────
    scene.add.text(badgeX + 3, y + 42, server_tokens + 'T', {
      fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#664400'
    }).setOrigin(0.5);

    // ── Status indicator ──────────────────────────────────────────────────
    const status = agentData.last_active ? 'ACTIVE' : 'STANDBY';
    scene.add.text(x + 450, y + 30, status, {
      fontFamily: 'Share Tech Mono', fontSize: '8px',
      color: status === 'ACTIVE' ? '#00ff88' : '#ffcc00'
    }).setOrigin(1, 0.5);

    // ── Click: open skill tree ────────────────────────────────────────────
    if (!scene._skillModal) {
      scene._skillModal = new SkillTreeModal(scene);
    }
    bg.on('pointerover', () => bg.setStrokeStyle(tier === 3 ? 2 : 1, glow, 1));
    bg.on('pointerout',  () => bg.setStrokeStyle(tier === 3 ? 2 : 1, glow, tier === 3 ? 0.9 : 0.4));
    bg.on('pointerdown', () => scene._skillModal.open(agentData));
  }
}
