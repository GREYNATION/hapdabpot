export interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export class Session {
  private messages: Message[] = [];
  public metadata: Record<string, any> = {};

  constructor(initialSystemPrompt?: string) {
    if (initialSystemPrompt) {
      this.messages.push({ role: "system", content: initialSystemPrompt });
    }
  }

  public addMessage(message: Message) {
    this.messages.push(message);
  }

  public getMessages(): Message[] {
    return this.messages;
  }

  public clear() {
    this.messages = [];
  }

  public lastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }
}
