/**
 * SkillTreeModal.js
 * Holographic slide-in modal when you click an agent card.
 * Shows tier, XP bar, skills (locked/unlocked), and upgrade button.
 */

const TIER_LABELS  = { 1: 'NOVICE', 2: 'VETERAN', 3: 'MASTER' };
const TIER_COLORS  = { 1: 0x00aaff, 2: 0xc0c0c0, 3: 0xffcc00 };
const TIER_COSTS   = { 1: 10, 2: 25, 3: null };

const ALL_SKILLS = [
  { id: 'BATCH_PROCESSING', label: 'Batch Processing',  tier: 2, desc: '5 parallel tool calls' },
  { id: 'WEB_SEARCH',       label: 'Web Search',        tier: 2, desc: 'Brave Search access' },
  { id: 'FLUX_DEV_IMAGE',   label: 'Quality Imaging',   tier: 2, desc: 'flux-dev-image model' },
  { id: 'CRON_AUTONOMY',    label: 'Cron Autonomy',     tier: 3, desc: 'node-cron self-scheduling' },
  { id: 'VISION_ANALYSIS',  label: 'Vision Analysis',   tier: 3, desc: 'Image understanding' },
  { id: 'ADVANCED_MODELS',  label: 'Advanced Models',   tier: 3, desc: 'kling + flux-kontext' },
  { id: 'PARALLEL_TOOLS',   label: 'Parallel Tools',    tier: 3, desc: '20-item batch jobs' },
];

export class SkillTreeModal {
  constructor(scene) {
    this.scene   = scene;
    this.objects = [];
    this.visible = false;
  }

  open(agentData) {
    if (this.visible) this.close();
    this.visible = true;
    this.agentData = agentData;
    const s = this.scene;

    // ── Backdrop ───────────────────────────────────────────────────────────
    this.backdrop = s.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7)
      .setInteractive()
      .on('pointerdown', () => this.close());
    this.objects.push(this.backdrop);

    // ── Modal panel ────────────────────────────────────────────────────────
    const mx = 320, my = 60, mw = 640, mh = 600;
    const tier      = agentData.tier || 1;
    const tierColor = TIER_COLORS[tier];

    const panel = s.add.rectangle(mx + mw / 2, my + mh / 2, mw, mh, 0x000d08)
      .setStrokeStyle(2, tierColor, 1);
    this.objects.push(panel);

    // Animate in from right
    panel.x = 1400;
    s.tweens.add({ targets: panel, x: mx + mw / 2, duration: 300, ease: 'Power3' });

    // ── Agent name + tier badge ────────────────────────────────────────────
    const nameText = s.add.text(mx + 20, my + 20, agentData.display_name || agentData.agent_id, {
      fontFamily: 'Orbitron', fontSize: '20px',
      color: '#' + tierColor.toString(16).padStart(6, '0')
    });
    this.objects.push(nameText);

    const tierLabel = s.add.text(mx + mw - 20, my + 20, TIER_LABELS[tier] + ' — TIER ' + tier, {
      fontFamily: 'Share Tech Mono', fontSize: '11px',
      color: '#' + tierColor.toString(16).padStart(6, '0')
    }).setOrigin(1, 0);
    this.objects.push(tierLabel);

    // ── XP Bar ────────────────────────────────────────────────────────────
    const xp       = agentData.xp || 0;
    const xpToNext = agentData.xp_to_next || 100;
    const xpPct    = Math.min(xp % 100 / 100, 1);

    s.add.text(mx + 20, my + 54, `LVL ${agentData.level || 1}  XP ${xp} / ${xp + xpToNext}`, {
      fontFamily: 'Share Tech Mono', fontSize: '11px', color: '#006633'
    }).tap(t => this.objects.push(t));

    const barBg = s.add.rectangle(mx + 20 + 280, my + 62, 300, 8, 0x001a0d).setOrigin(0.5, 0.5);
    const barFg = s.add.rectangle(mx + 20 + 280 - 150 + (xpPct * 150), my + 62, xpPct * 300, 8, 0x00ff88).setOrigin(0.5, 0.5);
    this.objects.push(barBg, barFg);

    // ── Server Tokens ──────────────────────────────────────────────────────
    const tokens = agentData.server_tokens || 0;
    const nextCost = TIER_COSTS[tier];
    const canUpgrade = tier < 3 && tokens >= nextCost;

    s.add.text(mx + 20, my + 82, `SERVER TOKENS: ${tokens}`, {
      fontFamily: 'Orbitron', fontSize: '12px', color: '#ffcc00'
    }).tap(t => this.objects.push(t));

    if (nextCost) {
      s.add.text(mx + 20, my + 98, `Next tier costs: ${nextCost} tokens`, {
        fontFamily: 'Share Tech Mono', fontSize: '10px', color: '#664400'
      }).tap(t => this.objects.push(t));
    }

    // ── Skills Grid ────────────────────────────────────────────────────────
    s.add.text(mx + 20, my + 124, 'SKILL TREE', {
      fontFamily: 'Orbitron', fontSize: '12px', color: '#007744'
    }).tap(t => this.objects.push(t));

    const unlockedSkills = agentData.skills || [];
    ALL_SKILLS.forEach((skill, i) => {
      const col     = i % 2;
      const row     = Math.floor(i / 2);
      const sx      = mx + 20 + col * 308;
      const sy      = my + 148 + row * 80;
      const unlocked = unlockedSkills.includes(skill.id);
      const skillTierColor = TIER_COLORS[skill.tier];

      const sbg = s.add.rectangle(sx + 140, sy + 30, 288, 64, unlocked ? 0x001a0d : 0x080808)
        .setStrokeStyle(1, unlocked ? skillTierColor : 0x111111, unlocked ? 0.8 : 0.3);
      this.objects.push(sbg);

      // Lock icon or checkmark
      const icon = s.add.text(sx + 8, sy + 30, unlocked ? '■' : '□', {
        fontFamily: 'Share Tech Mono', fontSize: '14px',
        color: unlocked ? '#' + skillTierColor.toString(16).padStart(6, '0') : '#222222'
      }).setOrigin(0, 0.5);
      this.objects.push(icon);

      const sname = s.add.text(sx + 28, sy + 18, skill.label, {
        fontFamily: 'Orbitron', fontSize: '10px',
        color: unlocked ? '#' + skillTierColor.toString(16).padStart(6, '0') : '#333333'
      });
      this.objects.push(sname);

      const sdesc = s.add.text(sx + 28, sy + 36, skill.desc, {
        fontFamily: 'Share Tech Mono', fontSize: '9px',
        color: unlocked ? '#005533' : '#222222'
      });
      this.objects.push(sdesc);

      const stier = s.add.text(sx + 28, sy + 50, `TIER ${skill.tier} REQUIRED`, {
        fontFamily: 'Share Tech Mono', fontSize: '8px',
        color: unlocked ? '#003322' : '#1a1a1a'
      });
      this.objects.push(stier);
    });

    // ── Upgrade Button ─────────────────────────────────────────────────────
    const btnY = my + mh - 60;
    if (tier < 3) {
      const btnColor = canUpgrade ? tierColor : 0x333333;
      const btnBg = s.add.rectangle(mx + mw / 2, btnY, 400, 44, canUpgrade ? 0x001a0d : 0x0a0a0a)
        .setStrokeStyle(2, btnColor, canUpgrade ? 1 : 0.3);
      this.objects.push(btnBg);

      const btnText = canUpgrade
        ? `UPGRADE TO TIER ${tier + 1} — SPEND ${nextCost} TOKENS`
        : `NEED ${nextCost - tokens} MORE TOKENS TO UPGRADE`;

      const btn = s.add.text(mx + mw / 2, btnY, btnText, {
        fontFamily: 'Orbitron', fontSize: '11px',
        color: canUpgrade ? '#' + btnColor.toString(16).padStart(6, '0') : '#333333'
      }).setOrigin(0.5);
      this.objects.push(btn);

      if (canUpgrade) {
        btnBg.setInteractive({ useHandCursor: true });
        btnBg.on('pointerover', () => btnBg.setFillStyle(0x003322));
        btnBg.on('pointerout',  () => btnBg.setFillStyle(0x001a0d));
        btnBg.on('pointerdown', () => this.confirmUpgrade(agentData));
      }
    } else {
      s.add.text(mx + mw / 2, btnY, 'MAX TIER ACHIEVED — MASTER STATUS', {
        fontFamily: 'Orbitron', fontSize: '12px', color: '#ffcc00'
      }).setOrigin(0.5).tap(t => this.objects.push(t));
    }

    // ── Close button ───────────────────────────────────────────────────────
    const closeBtn = s.add.text(mx + mw - 16, my + 10, 'X', {
      fontFamily: 'Share Tech Mono', fontSize: '14px', color: '#003322'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#00ff88'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#003322'));
    closeBtn.on('pointerdown', () => this.close());
    this.objects.push(closeBtn);
  }

  async confirmUpgrade(agentData) {
    const s = this.scene;
    // Call the backend
    try {
      const res = await fetch('/api/gamification/agents/' + agentData.agent_id + '/upgrade', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        this.close();
        // Flash success message
        const msg = s.add.text(640, 360, `TIER ${data.newTier} UNLOCKED`, {
          fontFamily: 'Orbitron', fontSize: '32px', color: '#ffcc00'
        }).setOrigin(0.5);
        s.tweens.add({
          targets: msg, alpha: 0, scale: 2, duration: 1500,
          onComplete: () => msg.destroy()
        });
        // Refresh dashboard data
        s.refreshData?.();
      } else {
        s.add.text(640, 360, data.error || 'UPGRADE FAILED', {
          fontFamily: 'Share Tech Mono', fontSize: '14px', color: '#ff4444'
        }).setOrigin(0.5).tap(t => {
          s.time.delayedCall(2000, () => t.destroy());
        });
      }
    } catch (e) {
      console.error('Upgrade failed:', e);
    }
  }

  close() {
    this.objects.forEach(o => o?.destroy?.());
    this.objects = [];
    this.visible = false;
  }
}

// tiny helper so we can chain .tap() on Phaser objects inline
Phaser.GameObjects.GameObject.prototype.tap = function(fn) { fn(this); return this; };
