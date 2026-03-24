import fs from "fs";
import path from "path";

export interface AgentTask {
    id: string;
    description: string;
    agentType: string;
    status: "pending" | "in-progress" | "completed" | "failed";
    timestamp: string;
}

export class TaskManager {
    private tasksPath = path.join(process.cwd(), ".antigravity", "team", "tasks.json");
    private tasks: AgentTask[] = [];

    constructor() {
        this.loadTasks();
    }

    private loadTasks() {
        try {
            if (fs.existsSync(this.tasksPath)) {
                const data = fs.readFileSync(this.tasksPath, "utf8");
                this.tasks = JSON.parse(data);
            } else {
                // Ensure directory exists
                const dir = path.dirname(this.tasksPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                this.saveTasks();
            }
        } catch (err) {
            console.error("[tasks] Failed to load tasks:", err);
            this.tasks = [];
        }
    }

    private saveTasks() {
        try {
            fs.writeFileSync(this.tasksPath, JSON.stringify(this.tasks, null, 2));
        } catch (err) {
            console.error("[tasks] Failed to save tasks:", err);
        }
    }

    createTask(description: string, agentType: string): AgentTask {
        const task: AgentTask = {
            id: Math.random().toString(36).substring(7),
            description,
            agentType,
            status: "pending",
            timestamp: new Date().toISOString()
        };
        this.tasks.push(task);
        this.saveTasks();
        return task;
    }

    getTasks(): AgentTask[] {
        return this.tasks;
    }

    getTasksByAgent(agentType: string): AgentTask[] {
        return this.tasks.filter(t => t.agentType === agentType);
    }

    updateTaskStatus(taskId: string, status: AgentTask["status"]) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = status;
            this.saveTasks();
        }
    }
}
