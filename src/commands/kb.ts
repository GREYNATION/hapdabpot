import { Context } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { log } from '../core/config.js';

const client = new Anthropic();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || './brain/knowledge';
const GITHUB_PAT = process.env.GITHUB_PAT || '';
const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL || '';
const GITHUB_USER_NAME = process.env.GITHUB_USER_NAME || 'hapdabot';
const GITHUB_USER_EMAIL = process.env.GITHUB_USER_EMAIL || 'bot@hapdabot.com';

// Inject PAT into URL for auth
const authedRepoUrl = GITHUB_REPO_URL?.includes('https://') 
  ? GITHUB_REPO_URL.replace('https://', `https://${GITHUB_USER_NAME}:${GITHUB_PAT}@`)
  : GITHUB_REPO_URL;

function gitSetup() {
  if (!GITHUB_PAT || !GITHUB_REPO_URL) {
      log("[KB] Skipping git setup: GITHUB_PAT or GITHUB_REPO_URL missing", "warn");
      return;
  }

  if (!fs.existsSync(VAULT_PATH)) {
    log('[KB] Cloning knowledge base repo...');
    fs.mkdirSync(path.dirname(VAULT_PATH), { recursive: true });
    execSync(`git clone ${authedRepoUrl} ${VAULT_PATH}`, { stdio: 'inherit' });
  }
  
  try {
    execSync(`git config user.name "${GITHUB_USER_NAME}"`, { cwd: VAULT_PATH });
    execSync(`git config user.email "${GITHUB_USER_EMAIL}"`, { cwd: VAULT_PATH });
    // Set remote with PAT in case it changed
    execSync(`git remote set-url origin ${authedRepoUrl}`, { cwd: VAULT_PATH });
  } catch (err: any) {
    log(`[KB] Git config failed: ${err.message}`, "error");
  }
}

function gitCommitAndPush(filename: string) {
  if (!GITHUB_PAT || !GITHUB_REPO_URL) return;

  try {
    execSync('git add .', { cwd: VAULT_PATH });
    execSync(`git commit -m "kb: add ${filename}"`, { cwd: VAULT_PATH });
    execSync('git push origin main', { cwd: VAULT_PATH });
    log(`[KB] Pushed ${filename} to GitHub`);
  } catch (err: any) {
    log(`[KB] Git push failed: ${err.message}`, "error");
    throw err;
  }
}

const KB_SYSTEM_PROMPT = `You are a knowledge base librarian. Convert raw content into Obsidian markdown.
Output ONLY the markdown file. No preamble. Use this exact format:

---
title: [concise title]
date: [today YYYY-MM-DD]
type: [article | paper | thread | repo | video]
source: [URL or "pasted"]
tags: [#tag1 #tag2 #tag3]
related: []
---

## Summary
2-3 sentence plain English summary.

## Key Points
- Point 1 (max 7)

## Concepts
**Name** â€” definition

## Quotes / Highlights
> "key quote"

## My Take


## Backlinks
[[]]`;

export async function handleKBCommand(ctx: Context) {
  const input = ctx.message && 'text' in ctx.message
    ? ctx.message.text.replace('/kb', '').trim()
    : '';

  if (!input) {
    await ctx.reply('Usage: /kb [url or pasted content]');
    return;
  }

  await ctx.reply('ðŸ“š **Processing for knowledge base...**');

  try {
    // Ensure repo is cloned and configured (if git is configured)
    if (GITHUB_PAT && GITHUB_REPO_URL) {
        gitSetup();
    }

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: KB_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
    });

    const mdContent = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Extract title for filename
    const titleMatch = mdContent.match(/title:\s*(.+)/);
    const rawTitle = titleMatch ? titleMatch[1].trim() : `note-${Date.now()}`;
    const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const filename = `${slug}.md`;
    const filepath = path.join(VAULT_PATH, filename);

    if (!fs.existsSync(VAULT_PATH)) fs.mkdirSync(VAULT_PATH, { recursive: true });
    fs.writeFileSync(filepath, mdContent, 'utf-8');

    let responseMsg = `âœ… **Saved to local vault**:\nðŸ“„ \`${filename}\``;

    // Commit and push to GitHub if configured
    if (GITHUB_PAT && GITHUB_REPO_URL) {
        try {
            gitCommitAndPush(filename);
            responseMsg = `âœ… **Saved + Pushed to GitHub**:\nðŸ“„ \`${filename}\`\n\nPull in Obsidian to sync.`;
        } catch (gitErr) {
            responseMsg += `\n\nâš ï¸ **Git Push Failed**: Check logs. Content saved locally.`;
        }
    }

    await ctx.reply(
      `${responseMsg}\n\n` +
      `Preview:\n\`\`\`markdown\n${mdContent.slice(0, 300)}...\n\`\`\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    log(`[KB] Error: ${err.message}`, "error");
    await ctx.reply(`âŒ **KB Error**: ${err instanceof Error ? err.message : String(err)}`);
  }
}

