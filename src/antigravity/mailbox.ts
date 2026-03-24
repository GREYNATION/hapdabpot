import fs from "fs";
import path from "path";

export interface MailboxMessage {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    read: boolean;
}

export class MailboxManager {
    private mailboxDir = path.join(process.cwd(), ".antigravity", "team", "mailbox");

    constructor() {
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.mailboxDir)) {
            fs.mkdirSync(this.mailboxDir, { recursive: true });
        }
    }

    sendMessage(from: string, to: string, subject: string, body: string): MailboxMessage {
        const id = Math.random().toString(36).substring(7);
        const message: MailboxMessage = {
            id,
            from,
            to,
            subject,
            body,
            timestamp: new Date().toISOString(),
            read: false
        };

        const fileName = `${id}_${from}_to_${to}.json`;
        fs.writeFileSync(path.join(this.mailboxDir, fileName), JSON.stringify(message, null, 2));
        return message;
    }

    getMessagesForAgent(agentName: string): MailboxMessage[] {
        const files = fs.readdirSync(this.mailboxDir);
        const messages: MailboxMessage[] = [];

        for (const file of files) {
            if (file.endsWith(".json")) {
                const content = fs.readFileSync(path.join(this.mailboxDir, file), "utf8");
                const message: MailboxMessage = JSON.parse(content);
                if (message.to === agentName) {
                    messages.push(message);
                }
            }
        }

        return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    markAsRead(messageId: string) {
        const files = fs.readdirSync(this.mailboxDir);
        for (const file of files) {
            if (file.startsWith(messageId) && file.endsWith(".json")) {
                const filePath = path.join(this.mailboxDir, file);
                const content = fs.readFileSync(filePath, "utf8");
                const message: MailboxMessage = JSON.parse(content);
                message.read = true;
                fs.writeFileSync(filePath, JSON.stringify(message, null, 2));
                break;
            }
        }
    }
}
