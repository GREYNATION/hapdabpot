import { randomUUID } from "crypto";
import { saveTask, updateTaskInDB, getTasks, getTask as getTaskFromDB } from "./taskMemory.js";

export type TaskStatus = "pending" | "running" | "complete" | "failed";

export interface Task {
  id: string;
  agent: string;
  task: string;
  status: TaskStatus;
  result?: string;
}

export function createTask(agent: string, task: string): Task {
  const id = randomUUID();

  const newTask: Task = {
    id,
    agent,
    task,
    status: "pending",
  };

  saveTask(newTask);
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>) {
    // Note: The new DAO updateTaskInDB expects specific parameters
    // We'll extract them from the updates object
    if (updates.status || updates.result) {
        // We use its current status if not provided in updates, but taskState doesn't track memory anymore
        // So we assume the caller provides what's needed or we just pass what we have
        updateTaskInDB(id, updates.status || "running", updates.result);
    }
}

export function getAllTasks(): Task[] {
  return getTasks() as Task[];
}

export function getTask(id: string): Task | undefined {
    return getTaskFromDB(id) as Task | undefined;
}

