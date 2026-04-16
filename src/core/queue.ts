import { log } from "./config.js";

type Task = () => Promise<void>;

/**
 * Ensures sequential processing of agent requests on a per-chat basis.
 * This prevents agents from colliding or losing context during rapid messages.
 */
export class RequestQueue {
    private static instance: RequestQueue;
    private queues: Map<number, Task[]> = new Map();
    private processing: Set<number> = new Set();

    public static getInstance() {
        if (!RequestQueue.instance) RequestQueue.instance = new RequestQueue();
        return RequestQueue.instance;
    }

    /**
     * Adds a task to the queue for a specific chat.
     */
    public async enqueue(chatId: number, task: Task): Promise<void> {
        if (!this.queues.has(chatId)) {
            this.queues.set(chatId, []);
        }

        const queue = this.queues.get(chatId)!;
        queue.push(task);

        if (!this.processing.has(chatId)) {
            await this.processQueue(chatId);
        }
    }

    private async processQueue(chatId: number) {
        this.processing.add(chatId);
        const queue = this.queues.get(chatId)!;

        while (queue.length > 0) {
            const task = queue.shift();
            if (task) {
                try {
                    await task();
                } catch (err: any) {
                    log(`[queue] Task failed for chat ${chatId}: ${err.message}`, "error");
                }
            }
        }

        this.processing.delete(chatId);
    }
}
