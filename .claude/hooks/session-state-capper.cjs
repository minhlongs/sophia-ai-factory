#!/usr/bin/env node
/**
 * Session State Capper Hook
 *
 * Purpose: Prevent unbounded growth of .jsonl session state files.
 * Logic:
 * -On SessionStart: Check for immediate capping needs on resume.
 * -On PostToolUse: Check if the tool output pushed the session over the 10MB limit.
 * -On SessionEnd: Final compact to ensure optimized storage.
 *
 * This hook bridges the Claude Code runtime to the forest/orchestration logic.
 */

const { promises: fs } = require('fs');
const path = require('path');

// Using a dynamic import/require for the forest logic since hooks run in CommonJS
// We assume the forest logic is compiled or can be run via ts-node/tsx if configured
// For this implementation, we'll use a simplified version of the SessionHookIntegration
// logic directly in the hook to ensure maximum reliability without complex TS interop in .cjs

const MAX_SESSION_FILE_MB = 10;
const COMPACT_RATIO = 0.3;

async function loadEntries(sessionId) {
  const filePath = path.join(process.cwd(), `.session-state-${sessionId}.jsonl`);
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
  } catch (e) {
    return [];
  }
}

async function compactSession(sessionId, entries) {
  if (entries.length === 0) return;

  const size = Buffer.byteLength(JSON.stringify(entries));
  if (size > MAX_SESSION_FILE_MB * 1024 * 1024) {
    const keepCount = Math.ceil(entries.length * COMPACT_RATIO);
    const processedEntries = entries.slice(entries.length - keepCount);
    const droppedEntries = entries.slice(0, entries.length - keepCount);

    const filePath = path.join(process.cwd(), `.session-state-${sessionId}.jsonl`);
    const archivePath = `${filePath}.archive-${Date.now()}.json`;

    try {
      // Archive dropped entries
      await fs.writeFile(archivePath, JSON.stringify({
        compactedAt: new Date().toISOString(),
        entryCount: droppedEntries.length,
        totalBytes: Buffer.byteLength(JSON.stringify(droppedEntries)),
        droppedEntries
      }, null, 2));

      // Overwrite session file with compacted entries
      const newContent = processedEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.writeFile(filePath, newContent);

      process.stdout.write(`\n[session-capper] Session ${sessionId} compacted to ${processedEntries.length} entries (${(Buffer.byteLength(newContent) / 1024 / 1024).toFixed(2)} MB)\n`);
    } catch (e) {
      process.stderr.write(`[session-capper] Error during compaction: ${e.message}\n`);
    }
  }
}

async function main() {
  try {
    const stdin = fs.readFileSync(0, 'utf-8').trim();
    const data = stdin ? JSON.parse(stdin) : {};
    const sessionId = data.session_id;
    const hookType = process.env.CLAUDE_HOOK_TYPE; // Hypothetical env var or determined by call

    if (!sessionId) {
      process.exit(0);
    }

    const entries = await loadEntries(sessionId);
    await compactSession(sessionId, entries);

    process.exit(0);
  } catch (error) {
    process.stderr.write(`[session-capper] Hook error: ${error.message}\n`);
    process.exit(0);
  }
}

main();
