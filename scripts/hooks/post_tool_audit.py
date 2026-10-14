#!/usr/bin/env python3
# Mekong CLI — AI-Powered Business Operations for Vietnam
# MIT License. Copyright (c) 2026 MekongMind. See LICENSE file.

"""Antigravity PostToolUse Telemetry & Audit Logger.

Appends command execution metadata to .mekong/audit/antigravity_hooks.log.
Adheres strictly to the fail-open contract: zero disruption under any failure.
Standard library only, ultra-fast execution (<10ms).
"""

from __future__ import annotations

import datetime
import json
import os
import sys


def _resolve_log_path() -> str:
    """Resolve destination log file path."""
    env_override = os.environ.get("MEKONG_AUDIT_LOG")
    if env_override:
        return env_override

    root_override = os.environ.get("MEKONG_ROOT")
    if root_override:
        return os.path.join(root_override, ".mekong", "audit", "antigravity_hooks.log")

    # Upward walk for workspace root
    curr = os.path.abspath(os.getcwd())
    walk = curr
    while True:
        if os.path.exists(os.path.join(walk, ".git")) or os.path.exists(os.path.join(walk, "HARNESS.md")):
            return os.path.join(walk, ".mekong", "audit", "antigravity_hooks.log")
        parent = os.path.dirname(walk)
        if parent == walk:
            break
        walk = parent

    return os.path.join(curr, ".mekong", "audit", "antigravity_hooks.log")


def _parse_cli_args(argv: list[str]) -> tuple[dict[str, any], list[str]]:
    """Parse CLI flags without importing heavy argparse."""
    flags: dict[str, any] = {}
    pos: list[str] = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("--command", "-c") and i + 1 < len(argv):
            flags["command"] = argv[i + 1]
            i += 2
        elif arg in ("--tool", "-t") and i + 1 < len(argv):
            flags["tool"] = argv[i + 1]
            i += 2
        elif arg in ("--exit-code", "-e") and i + 1 < len(argv):
            try:
                flags["exit_code"] = int(argv[i + 1])
            except ValueError:
                pass
            i += 2
        elif arg in ("--duration", "-d") and i + 1 < len(argv):
            try:
                flags["duration"] = float(argv[i + 1])
            except ValueError:
                pass
            i += 2
        elif arg in ("--status", "-s") and i + 1 < len(argv):
            flags["status"] = argv[i + 1]
            i += 2
        elif not arg.startswith("-"):
            pos.append(arg)
            i += 1
        else:
            i += 1
    return flags, pos


def _extract_telemetry() -> dict[str, any]:
    """Extract command, tool, exit code, and duration from stdin, argv, or env."""
    data: dict[str, any] = {}

    # 1. Try stdin JSON or raw text
    if not sys.stdin.isatty():
        try:
            raw_input = sys.stdin.read().strip()
            if raw_input:
                try:
                    data = json.loads(raw_input)
                except Exception:
                    data = {"command": raw_input}
        except Exception:
            pass

    # 2. Try CLI arguments
    flags, pos = _parse_cli_args(sys.argv[1:])

    # Extract command
    tool_input = data.get("tool_input") if isinstance(data.get("tool_input"), dict) else {}
    tool_call = data.get("toolCall") if isinstance(data.get("toolCall"), dict) else {}
    tool_call_args = tool_call.get("args") if isinstance(tool_call.get("args"), dict) else {}

    command = (
        flags.get("command")
        or (pos[0] if pos else None)
        or tool_input.get("CommandLine")
        or tool_input.get("command")
        or tool_call_args.get("CommandLine")
        or tool_call_args.get("command")
        or data.get("command")
        or data.get("cmd")
        or os.environ.get("ANTIGRAVITY_COMMAND")
        or os.environ.get("TOOL_COMMAND")
        or os.environ.get("COMMAND_LINE")
        or ""
    )

    # Extract tool
    tool = (
        flags.get("tool")
        or data.get("tool_name")
        or tool_call.get("name")
        or data.get("tool")
        or os.environ.get("TOOL_NAME")
        or "run_command"
    )

    # Extract exit code
    tool_response = data.get("tool_response") if isinstance(data.get("tool_response"), dict) else {}
    tool_result = data.get("toolResult") if isinstance(data.get("toolResult"), dict) else {}

    exit_code_raw = (
        flags.get("exit_code")
        if "exit_code" in flags
        else (pos[1] if len(pos) > 1 else None)
    )
    if exit_code_raw is None:
        exit_code_raw = (
            tool_response.get("exit_code")
            or tool_response.get("exitCode")
            or tool_result.get("exit_code")
            or tool_result.get("exitCode")
            or data.get("exit_code")
            or data.get("exitCode")
            or os.environ.get("TOOL_EXIT_CODE")
            or 0
        )
    try:
        exit_code = int(exit_code_raw)
    except Exception:
        exit_code = 0

    # Extract duration
    duration_raw = (
        flags.get("duration")
        if "duration" in flags
        else (
            data.get("duration_ms")
            or data.get("duration")
            or tool_result.get("duration_ms")
            or tool_response.get("duration_ms")
            or 0.0
        )
    )
    try:
        duration_ms = float(duration_raw)
    except Exception:
        duration_ms = 0.0

    # Extract status
    status = (
        flags.get("status")
        or data.get("status")
        or ("success" if exit_code == 0 else "failed")
    )

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    timestamp_str = now_utc.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    cwd = (
        tool_input.get("Cwd")
        or tool_call_args.get("Cwd")
        or os.environ.get("PWD")
        or os.getcwd()
    )

    return {
        "timestamp": timestamp_str,
        "hook_event": "PostToolUse",
        "tool": str(tool),
        "command": str(command),
        "exit_code": exit_code,
        "status": str(status),
        "duration_ms": duration_ms,
        "cwd": str(cwd),
    }


def main() -> int:
    """Main logger execution with fail-open guarantee."""
    try:
        entry = _extract_telemetry()
        log_file = _resolve_log_path()
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        with open(log_file, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        # Strictly fail open: never crash or block tool execution
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
