import express, { Request, Response } from 'express';
import { executeWithTier } from '../services/orchestrator.js';

export const createAgentRouter = () => {
  const router = express.Router();

  router.post('/agent/run', async (req: Request, res: Response) => {
    const { agent } = req.body;
    
    if (!agent) {
       return res.status(400).json({ status: "error", message: "Agent payload required" });
    }

    try {
      const job = await executeWithTier(agent?.id || "orchestrator", async (config) => ({ agent, config }));
      res.json({ status: "started", job });
    } catch (err: any) {
      res.status(500).json({ status: "error", error: err.message });
    }
  });

  return router;
};
