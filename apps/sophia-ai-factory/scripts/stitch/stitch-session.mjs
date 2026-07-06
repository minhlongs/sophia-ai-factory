#!/usr/bin/env node
/**
 * stitch-session.mjs — Session persistence for Stitch pipeline
 *
 * Survives context compaction and session restarts by storing
 * project/screen/design-system state to ~/.claudekit/.stitch-session.json.
 *
 * Commands:
 *   init <orchestrator|stitch>   Create new session
 *   set-project <id> <name> [device]  Record project
 *   add-screen <id> <name>            Append screen
 *   set-design-system <assetId> <name> Record design system
 *   read                              Print state as JSON
 *   clear                             Delete state file
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_DIR = join(homedir(), ".claudekit");
const STATE_FILE = join(STATE_DIR, ".stitch-session.json");

function load() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}
function save(state) {
  state.updatedAt = new Date().toISOString();
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
function cmdInit(source) {
  const state = {
    source: source || "orchestrator",
    project: null,
    deviceType: null,
    screens: [],
    designSystem: null,
    updatedAt: new Date().toISOString(),
  };
  save(state);
  console.log(JSON.stringify(state));
}
function cmdSetProject(id, name, device) {
  const state = load() || {};
  state.project = { id, name };
  state.deviceType = device || "DESKTOP";
  save(state);
  console.log(JSON.stringify(state.project));
}
function cmdAddScreen(id, name) {
  const state = load() || {};
  if (!state.screens) state.screens = [];
  state.screens.push({ id, name });
  save(state);
  console.log(JSON.stringify({ id, name }));
}
function cmdSetDesignSystem(assetId, name) {
  const state = load() || {};
  state.designSystem = { assetId, name };
  save(state);
  console.log(JSON.stringify(state.designSystem));
}
function cmdRead() {
  const state = load();
  if (!state) {
    console.error("No session state found at", STATE_FILE);
    process.exit(1);
  }
  console.log(JSON.stringify(state, null, 2));
}
function cmdClear() {
  if (existsSync(STATE_FILE)) {
    unlinkSync(STATE_FILE);
    console.log("Session state cleared.");
  } else {
    console.log("No session state to clear.");
  }
}

const cmd = process.argv[2];
switch (cmd) {
  case "init":
    cmdInit(process.argv[3]);
    break;
  case "set-project":
    cmdSetProject(process.argv[3], process.argv[4], process.argv[5]);
    break;
  case "add-screen":
    cmdAddScreen(process.argv[3], process.argv.slice(4).join(" "));
    break;
  case "set-design-system":
    cmdSetDesignSystem(process.argv[3], process.argv.slice(4).join(" "));
    break;
  case "read":
    cmdRead();
    break;
  case "clear":
    cmdClear();
    break;
  default:
    console.error("Usage: stitch-session <command> [args...]");
    console.error("Commands: init, set-project, add-screen, set-design-system, read, clear");
    process.exit(1);
}
