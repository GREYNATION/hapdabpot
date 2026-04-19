/**
 * gamification.ts — Express routes for the Phaser command center
 * Mounted at /api/gamification
 */

import { Router } from 'express';
import { getAllStats, getAgentStats, upgradeTier, awardXP } from '../../services/xpEngine.js';

const router = Router();

// GET /api/gamification/agents — all agents with tier/xp/tokens
router.get('/agents', async (_req, res) => {
  try {
    const stats = await getAllStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gamification/agents/:id — single agent
router.get('/agents/:id', async (req, res) => {
  try {
    const stats = await getAgentStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'Agent not found' });
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gamification/agents/:id/upgrade — spend tokens to upgrade tier
router.post('/agents/:id/upgrade', async (req, res) => {
  try {
    const result = await upgradeTier(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gamification/award — manually award XP (for testing)
router.post('/award', async (req, res) => {
  const { agentId, eventType, metadata } = req.body;
  try {
    const result = await awardXP(agentId, eventType, metadata);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
