import { BaseAgent } from "./baseAgent.js";
import { Octokit } from "octokit";
import { config, log } from "../core/config.js";

export class GitHubAgent extends BaseAgent {
    private octokit: Octokit | null = null;

    constructor() {
        super("GitHub Specialist", "You are an expert GitHub assistant. You help the user manage their repositories, browse code, track issues, and understand their GitHub presence. You use your tools to provide real-time data from GitHub.");
        if (config.githubToken) {
            this.octokit = new Octokit({ auth: config.githubToken });
        }
    }

    getName(): string {
        return "GitHub Specialist";
    }

    getSystemPrompt(): string {
        return "You are an expert GitHub assistant. You help the user manage their repositories, browse code, track issues, and understand their GitHub presence. You use your tools to provide real-time data from GitHub. Always be precise and helpful.";
    }

    public async executeTool(name: string, args: any): Promise<string> {
        // First check GitHub tools
        const githubResult = await this.executeGitHubTool(name, args);
        if (githubResult !== "Unknown GitHub tool") {
            return githubResult;
        }
        
        // Fallback to base tools (web_search, etc.)
        return super.executeTool(name, args);
    }

    private async executeGitHubTool(name: string, args: any): Promise<string> {
        if (!this.octokit) {
            return "Error: GitHub Token is not configured. Please add GITHUB_TOKEN to your .env file.";
        }

        try {
            if (name === "github_list_repos") {
                const response = await this.octokit.rest.repos.listForAuthenticatedUser({
                    sort: "updated",
                    per_page: 10
                });
                const repos = response.data.map(repo => `- ${repo.full_name}: ${repo.description || "No description"}`).join("\n");
                return repos.length > 0 ? `Your recent repositories:\n\n${repos}` : "You don't have any repositories yet.";
            }

            if (name === "github_get_repo") {
                const [owner, repo] = args.repoFullName.split("/");
                const response = await this.octokit.rest.repos.get({ owner, repo });
                const d = response.data;
                return `Repository: ${d.full_name}\nDescription: ${d.description}\nStars: ${d.stargazers_count}\nLanguage: ${d.language}\nURL: ${d.html_url}`;
            }

            if (name === "github_list_files") {
                const [owner, repo] = args.repoFullName.split("/");
                const path = args.path || "";
                const response = await this.octokit.rest.repos.getContent({ owner, repo, path });
                
                if (Array.isArray(response.data)) {
                    const files = response.data.map(f => `- ${f.type === "dir" ? "[DIR] " : ""}${f.path}`).join("\n");
                    return `Files in ${args.repoFullName}${path ? `/${path}` : ""}:\n\n${files}`;
                }
                return "This path is a file, not a directory.";
            }

            if (name === "github_read_file") {
                const [owner, repo] = args.repoFullName.split("/");
                const path = args.path;
                const response = await this.octokit.rest.repos.getContent({ owner, repo, path });
                
                if (!Array.isArray(response.data) && "content" in response.data) {
                    const content = Buffer.from(response.data.content, "base64").toString("utf-8");
                    return `Content of ${path} in ${args.repoFullName}:\n\n${content.substring(0, 8000)}`;
                }
                return "Error: Could not read file content.";
            }

            if (name === "github_list_issues") {
                const [owner, repo] = args.repoFullName.split("/");
                const response = await this.octokit.rest.issues.listForRepo({ owner, repo, state: "open", per_page: 10 });
                const issues = response.data.map(i => `- #${i.number}: ${i.title}`).join("\n");
                return issues.length > 0 ? `Open issues in ${args.repoFullName}:\n\n${issues}` : "No open issues found.";
            }

            return "Unknown GitHub tool";
        } catch (e: any) {
            log(`[github] Tool error: ${e.message}`, "error");
            return `GitHub API Error: ${e.message}`;
        }
    }

    protected getTools(): any[] {
        const githubTools: any[] = [
            {
                type: "function",
                function: {
                    name: "github_list_repos",
                    description: "List the user's recent GitHub repositories.",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "github_get_repo",
                    description: "Get detailed information about a specific GitHub repository.",
                    parameters: {
                        type: "object",
                        properties: {
                            repoFullName: { type: "string", description: "The full name of the repo (e.g., 'owner/repo')." }
                        },
                        required: ["repoFullName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "github_list_files",
                    description: "List files and directories in a specific repository path.",
                    parameters: {
                        type: "object",
                        properties: {
                            repoFullName: { type: "string", description: "The full name of the repo." },
                            path: { type: "string", description: "The path within the repo (optional)." }
                        },
                        required: ["repoFullName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "github_read_file",
                    description: "Read the content of a specific file in a GitHub repository.",
                    parameters: {
                        type: "object",
                        properties: {
                            repoFullName: { type: "string", description: "The full name of the repo." },
                            path: { type: "string", description: "The path to the file." }
                        },
                        required: ["repoFullName", "path"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "github_list_issues",
                    description: "List open issues in a specific repository.",
                    parameters: {
                        type: "object",
                        properties: {
                            repoFullName: { type: "string", description: "The full name of the repo." }
                        },
                        required: ["repoFullName"]
                    }
                }
            }
        ];

        return [...githubTools, ...super.getTools()];
    }
}
