import express, { Request, Response } from 'express';
import { runAgentTask } from "../core/agentRunner.js";
import { orchestrate } from "../core/orchestrator/index.js";

export const createAgentRouter = () => {
  const router = express.Router();

  const jobStore = new Map();

  router.post('/agent/run', async (req: Request, res: Response) => {
    const { agent } = req.body;

    if (!agent || !agent.id || !agent.task) {
      return res.status(400).json({
        status: "error",
        message: "Missing agent.id or agent.task"
      });
    }

    const jobId = `job_${Date.now()}`;

    jobStore.set(jobId, { status: "queued" });

    runAgentTask(async () => {
      jobStore.set(jobId, { status: "running" });

      const result = await orchestrate(agent);

      jobStore.set(jobId, {
        status: "done",
        result
      });

    }).catch(err => {
      console.error(`[agent:${jobId}] failed`, err);
      jobStore.set(jobId, {
        status: "error",
        error: err.message
      });
    });

    return res.json({
      status: "queued",
      jobId
    });
  });

  router.get('/agent/status/:id', (req: Request, res: Response) => {
    const job = jobStore.get(req.params.id);

    if (!job) {
      return res.status(404).json({ status: "not_found" });
    }

    return res.json(job);
  });

  return router;
};
