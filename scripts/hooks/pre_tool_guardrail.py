#!/usr/bin/env python3
# Mekong CLI — AI-Powered Business Operations for Vietnam
# MIT License. Copyright (c) 2026 MekongMind. See LICENSE file.

"""Antigravity PreToolUse Safety Guardrail Engine.

Intercepts tool invocations (primarily `run_command` and file modifications) to enforce
Mekong CLI's HARNESS.md runtime contract. Blocks destructive git operations, unverified
production deployments, irreversible VAS/tax ledger mutations, and QUAN DOANH boundary
modifications unless authorized with CEO override authority.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sys
from typing import Any, NamedTuple


class GuardrailRule(NamedTuple):
    rule_id: str
    category: str
    name: str
    pattern: re.Pattern[str]
    reason: str
    authority: str


# =============================================================================
# Pre-compiled Guardrail Rule Definitions
# =============================================================================

RULES: list[GuardrailRule] = [
    # -------------------------------------------------------------------------
    # 1. Destructive Git Operations
    # -------------------------------------------------------------------------
    GuardrailRule(
        rule_id="git_force_push",
        category="destructive_git",
        name="Destructive Git Force Push",
        pattern=re.compile(
            r"(?is)\bgit\s+['\"]?push['\"]?\b.*?(?:--force\b|-f\b|--force-with-lease\b|\+[a-zA-Z0-9_\/.-]+)"
        ),
        reason="Forced git pushes rewrite remote commit history and destroy branch state.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_push_main",
        category="destructive_git",
        name="Direct Push to Protected Branch",
        pattern=re.compile(
            r"(?is)\bgit\s+['\"]?push['\"]?\b.*?(?:(?<=[\s:\"'\\])|(?<=refs/heads/))(?:main|master)(?:\s|$|;|--|\"|'|\)|:)"
        ),
        reason="Direct push to main or master branch is forbidden without review gate.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_delete_remote",
        category="destructive_git",
        name="Remote Branch Deletion",
        pattern=re.compile(
            r"(?is)\bgit\s+['\"]?push['\"]?\b.*?(?:--delete\b\s+['\"]?[a-zA-Z0-9_\/.-]+['\"]?|(?<=[\s\"']):['\"]?[a-zA-Z0-9_\/.-]+['\"]?)"
        ),
        reason="Deleting remote branches destroys collaborative work state.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_reset_hard",
        category="destructive_git",
        name="Destructive Git Hard Reset",
        pattern=re.compile(r"(?is)\bgit\s+['\"]?reset['\"]?\b.*?(?:--hard\b|-hard\b)"),
        reason="Hard reset discards uncommitted work and permanently moves branch HEAD.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_reset_merge",
        category="destructive_git",
        name="Destructive Git Merge Reset",
        pattern=re.compile(r"(?is)\bgit\s+['\"]?reset['\"]?\b.*?(?:--merge\b)"),
        reason="Merge reset discards conflicted and uncommitted merge state.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_clean_force",
        category="destructive_git",
        name="Destructive Git Workspace Clean",
        pattern=re.compile(r"(?is)\bgit\s+['\"]?clean['\"]?\b.*?(?:-[a-zA-Z]*f[a-zA-Z]*|--force\b)"),
        reason="Force clean permanently deletes untracked files and directories from the repository.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_checkout_force",
        category="destructive_git",
        name="Destructive Git Force Checkout",
        pattern=re.compile(r"(?is)\bgit\s+['\"]?checkout['\"]?\b.*?(?:-f\b|--force\b)"),
        reason="Force checkout discards modified local files without stashing.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="git_branch_force_delete",
        category="destructive_git",
        name="Destructive Branch Deletion",
        pattern=re.compile(r"(?is)\bgit\s+['\"]?branch['\"]?\b.*?(?:-D\b)"),
        reason="Force deleting a branch (-D) bypasses unmerged commit checks.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    # -------------------------------------------------------------------------
    # 2. Production Deployments
    # -------------------------------------------------------------------------
    GuardrailRule(
        rule_id="ship_prod",
        category="production_deploy",
        name="Unverified Production Ship",
        pattern=re.compile(
            r"(?is)\b(?:mekong\s+)?['\"]?ship['\"]?\b.*?(?:--prod\b|--production\b|--env\s+['\"]?prod(?:uction)?['\"]?\b)"
        ),
        reason="Shipping to production requires verified staging promotion and CEO approval.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="ci_deploy_prod",
        category="production_deploy",
        name="Unverified CI Production Deploy",
        pattern=re.compile(
            r"(?is)\b(?:mekong\s+)?ci\s+['\"]?deploy['\"]?\b.*?(?:--prod\b|--production\b|--env\s+['\"]?prod(?:uction)?['\"]?\b|-e\s+['\"]?prod(?:uction)?['\"]?\b)"
        ),
        reason="Production CI deployment requires release gate clearance.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="deploy_prod",
        category="production_deploy",
        name="Unverified Production Deploy Target",
        pattern=re.compile(
            r"(?is)\b(?:mekong\s+)?['\"]?deploy['\"]?\b.*?(?:--env\s+['\"]?prod(?:uction)?['\"]?\b|-e\s+['\"]?prod(?:uction)?['\"]?\b|--target\s+['\"]?prod(?:uction)?['\"]?\b|--prod\b|--production\b)"
        ),
        reason="Deploying to production target is gated under HARNESS runtime contract.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="wrangler_deploy_prod",
        category="production_deploy",
        name="Production Cloudflare Deploy",
        pattern=re.compile(
            r"(?is)\bwrangler\s+['\"]?deploy['\"]?\b.*?(?:--env\s+['\"]?prod(?:uction)?['\"]?\b|-e\s+['\"]?prod(?:uction)?['\"]?\b)"
        ),
        reason="Direct Cloudflare production deployment requires staged approval.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="k8s_helm_prod",
        category="production_deploy",
        name="Production Kubernetes / Helm Mutation",
        pattern=re.compile(
            r"(?is)\b(?:kubectl|helm)\b.*?(?:-n\s+['\"]?prod(?:uction)?['\"]?\b|--namespace\s+['\"]?prod(?:uction)?['\"]?\b)"
        ),
        reason="Production Kubernetes namespace mutations require verified deployment procedures.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="package_publish",
        category="production_deploy",
        name="Public Package Publish",
        pattern=re.compile(
            r"(?is)\b(?:npm\s+publish|pnpm\s+publish|yarn\s+publish|poetry\s+publish|twine\s+upload)\b"
        ),
        reason="Publishing packages to public registries is irreversible.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    # -------------------------------------------------------------------------
    # 3. Irreversible VAS Accounting & Tax Ledger Operations
    # -------------------------------------------------------------------------
    GuardrailRule(
        rule_id="sql_drop_ledger",
        category="vas_accounting",
        name="Direct Accounting Database Mutation",
        pattern=re.compile(
            r"(?is)\b(?:sqlite3|psql|mysql)\b.*?\b(?:drop\s+table|truncate\s+table|delete\s+from)\s+['\"]?(?:ledger|invoices|transactions|accounting|tax|zenpay|tenants)['\"]?\b"
        ),
        reason="Dropping or truncating VAS accounting tables destroys immutable ledger state.",
        authority="HARNESS.md §4 High-Risk Gate (VAS TT78/2021)",
    ),
    GuardrailRule(
        rule_id="rm_accounting_data",
        category="vas_accounting",
        name="Accounting / Treasury File Deletion",
        pattern=re.compile(
            r"(?is)\brm\b.*?(?:\.mekong\/(?:treasury|raas)|data\/(?:accounting|invoices|ledger)|ledger\.db|treasury\.db|invoices\.db|tenants\.db)"
        ),
        reason="Direct deletion of treasury or accounting database files is prohibited.",
        authority="HARNESS.md §4 High-Risk Gate (VAS TT78/2021)",
    ),
    GuardrailRule(
        rule_id="company_reset",
        category="vas_accounting",
        name="Destructive Company Reset",
        pattern=re.compile(r"(?is)\b(?:mekong\s+)?company\s+reset\b"),
        reason="Company reset purges company databases, ledger, and configuration.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="billing_purge",
        category="vas_accounting",
        name="Billing Ledger Deletion / Purge",
        pattern=re.compile(r"(?is)\b(?:mekong\s+)?billing\b.*?(?:delete\b|purge\b|--reset\b)"),
        reason="Deleting or resetting billing ledger data destroys metering audit records.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="ketoan_irreversible_mutation",
        category="vas_accounting",
        name="Irreversible VAS Accounting Mutation",
        pattern=re.compile(
            r"(?is)\b(?:mekong\s+)?ke-toan\b.*?(?:post\b|create\s+--commit\b|mutate\b|close\b)"
        ),
        reason="Direct posting, commit creation, or closing of accounting ledgers is irreversible.",
        authority="HARNESS.md §4 High-Risk Gate (VAS TT78/2021)",
    ),
    GuardrailRule(
        rule_id="ketoan_close_standalone",
        category="vas_accounting",
        name="VAS Accounting Period Close",
        pattern=re.compile(r"(?is)\bke-toan\s+close\b"),
        reason="Closing accounting period commits final tax and financial books.",
        authority="HARNESS.md §4 High-Risk Gate (VAS TT78/2021)",
    ),
    GuardrailRule(
        rule_id="thue_irreversible_submission",
        category="vas_accounting",
        name="Tax Return Submission / Payment",
        pattern=re.compile(r"(?is)\b(?:mekong\s+)?thue\b.*?(?:submit\b|pay\b)"),
        reason="Submitting or paying tax filings creates binding statutory obligations.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    GuardrailRule(
        rule_id="thue_pay_standalone",
        category="vas_accounting",
        name="Direct Tax Payment",
        pattern=re.compile(r"(?is)\bthue\s+pay\b"),
        reason="Tax payment command initiates financial treasury transfer.",
        authority="HARNESS.md §4 High-Risk Gate",
    ),
    # -------------------------------------------------------------------------
    # 4. QUAN DOANH Boundary Path Protection
    # -------------------------------------------------------------------------
    GuardrailRule(
        rule_id="quan_doanh_shell_mod",
        category="quan_doanh_boundary",
        name="QUAN DOANH Boundary Modification",
        pattern=re.compile(
            r"(?is)\b(?:rm|mv|cp|touch|sed|git\s+rm|chmod|chown|truncate|unlink|tee)\b.*?(\b|\/)(?:mekong\/(?:bootstrap|constitution|hooks|init|audit)|\.claude\/hooks)\b"
        ),
        reason="QUAN DOANH (Command HQ) paths are strictly read-only military zones.",
        authority="boundary-check.cjs & HARNESS.md §2 Guardrails",
    ),
    GuardrailRule(
        rule_id="quan_doanh_redirection",
        category="quan_doanh_boundary",
        name="QUAN DOANH Redirection Modification",
        pattern=re.compile(
            r"(?is)(?:>|>>)\s*['\"]?(?:\.\/)?(?:mekong\/(?:bootstrap|constitution|hooks|init|audit)|\.claude\/hooks)"
        ),
        reason="Redirection write into QUAN DOANH protected boundary is prohibited.",
        authority="boundary-check.cjs & HARNESS.md §2 Guardrails",
    ),
]

# Pattern for checking file modification tool targets
QUAN_DOANH_PATH_PATTERN = re.compile(
    r"(?is)(?:^|/)(?:mekong/(?:bootstrap|constitution|hooks|init|audit)|\.claude/hooks)(?:/|$)"
)


# =============================================================================
# Input Ingestion & Normalization
# =============================================================================

def extract_command_and_context() -> tuple[str, str, dict[str, Any]]:
    """Extract command string, raw input text, and structured payload.
    
    Supports:
    1. CLI args (sys.argv)
    2. Environment variables (TOOL_COMMAND, TOOL_INPUT, etc.)
    3. Stdin JSON (Antigravity toolCall, Claude Code tool_input, or raw string)
    """
    raw_text = ""
    payload: dict[str, Any] = {}
    cmd = ""

    # 1. CLI Arguments
    argv = sys.argv[1:]
    if argv:
        if argv[0] in ("--command", "-c") and len(argv) > 1:
            cmd = argv[1]
        elif not argv[0].startswith("-"):
            cmd = " ".join(argv)
        raw_text += " " + " ".join(argv)

    # 2. Environment Variables
    if not cmd:
        for env_key in ("ANTIGRAVITY_COMMAND", "TOOL_COMMAND", "COMMAND_LINE", "MEKONG_GUARDRAIL_COMMAND"):
            val = os.environ.get(env_key, "").strip()
            if val:
                cmd = val
                break

    # 3. Stdin Payload
    if not sys.stdin.isatty():
        try:
            stdin_data = sys.stdin.read().strip()
            if stdin_data:
                raw_text += " " + stdin_data
                try:
                    payload = json.loads(stdin_data)
                except Exception:
                    # Treat non-JSON stdin as raw command if none set yet
                    if not cmd:
                        cmd = stdin_data
        except Exception:
            pass

    # Extract command from JSON payload if present and not already found
    if payload and isinstance(payload, dict):
        tool_call = payload.get("toolCall") if isinstance(payload.get("toolCall"), dict) else {}
        tool_call_args = tool_call.get("args") if isinstance(tool_call.get("args"), dict) else {}

        tool_input = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}

        candidate = (
            tool_call_args.get("CommandLine")
            or tool_call_args.get("command")
            or tool_input.get("CommandLine")
            or tool_input.get("command")
            or payload.get("CommandLine")
            or payload.get("command")
            or payload.get("cmd")
        )
        if candidate and isinstance(candidate, str):
            cmd = candidate.strip()

    return cmd, raw_text, payload


def is_ceo_override(
    cmd: str,
    raw_text: str = "",
    argv: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> bool:
    """Check if CEO override authority is present and valid.

    Valid overrides:
    1. Environment variable MEKONG_CEO_OVERRIDE in ('1', 'true', 'yes', 'y')
    2. CLI flag --ceo-override or --ceo-override=(1|true|yes)
    3. JSON payload with ceo_override=True / 1

    Invalid/rejected overrides:
    - --ceo-override=0, --ceo-override=false, --no-ceo-override, --ceo-override-fake
    - Commit messages or quoted text mentioning '--ceo-override'
    - Preceding/piped benign commands echoing or grepping '--ceo-override'
    """
    argv = argv or []
    VALID_TRUTHY = {"1", "true", "yes", "y"}

    # 1. Environment variable
    env_val = os.environ.get("MEKONG_CEO_OVERRIDE", "").strip().lower()
    if env_val in VALID_TRUTHY:
        return True

    # 2. JSON Payload flags
    if payload and isinstance(payload, dict):
        for key in ("ceo_override", "ceoOverride", "MEKONG_CEO_OVERRIDE"):
            val = payload.get(key)
            if val is True or (isinstance(val, (str, int)) and str(val).strip().lower() in VALID_TRUTHY):
                return True

    # 3. Direct script argv (flags passed directly to pre_tool_guardrail.py)
    for arg in argv:
        clean = arg.strip()
        if clean == "--ceo-override":
            return True
        if clean.lower().startswith("--ceo-override="):
            val = clean.split("=", 1)[1].strip().lower()
            if val in VALID_TRUTHY:
                return True

    if not cmd:
        return False

    # 4. Command string parsing
    if "--ceo-override" not in cmd.lower() and "mekong_ceo_override" not in cmd.lower():
        return False

    try:
        # Pre-space delimiters so commands unspaced around ; | & are properly separated
        spaced_cmd = re.sub(r"([;&|]+)", r" \1 ", cmd)
        tokens = shlex.split(spaced_cmd)
    except Exception:
        # Fallback to whitespace tokenization if shlex encounters unclosed quotes
        tokens = cmd.split()

    SEPARATORS = {";", "&&", "||", "|", "&", "\n"}
    BENIGN_ECHO_CMDS = {"echo", "printf", "grep", "egrep", "fgrep", "cat"}
    MESSAGE_FLAGS = {"-m", "--message", "-c", "--comment"}

    def is_msg_flag(tok: str) -> bool:
        if tok in MESSAGE_FLAGS:
            return True
        if tok.startswith("-") and not tok.startswith("--") and "m" in tok:
            return True
        return False

    current_cmd = ""
    prev_tok = ""

    for tok in tokens:
        if tok in SEPARATORS:
            current_cmd = ""
            prev_tok = tok
            continue

        if not current_cmd:
            if "=" in tok and not tok.startswith("-") and not tok.startswith("/"):
                # Shell variable assignment prefix like MEKONG_CEO_OVERRIDE=1
                var_parts = tok.split("=", 1)
                if var_parts[0].strip().upper() == "MEKONG_CEO_OVERRIDE":
                    val = var_parts[1].strip("\"'").lower()
                    if val in VALID_TRUTHY:
                        return True
                prev_tok = tok
                continue
            current_cmd = os.path.basename(tok).lower()

        clean_tok = tok.strip("\"'")
        low_tok = clean_tok.lower()

        is_override = False
        if low_tok == "--ceo-override":
            is_override = True
        elif low_tok.startswith("--ceo-override="):
            val = low_tok.split("=", 1)[1].strip()
            if val in VALID_TRUTHY:
                is_override = True

        if is_override:
            # Check context:
            # Do not treat commit messages or message flags as override
            if is_msg_flag(prev_tok):
                pass
            # Do not treat arguments to echo/printf/grep as override
            elif current_cmd in BENIGN_ECHO_CMDS:
                pass
            else:
                return True

        prev_tok = tok

    return False


# =============================================================================
# Guardrail Evaluation
# =============================================================================

def evaluate_guardrails(cmd: str, payload: dict[str, Any]) -> tuple[bool, GuardrailRule | None]:
    """Evaluate command and payload against all guardrail rules.
    
    Returns:
        (is_blocked, matched_rule)
    """
    # 1. Evaluate command string against regex rules
    if cmd:
        # Path normalization: collapse multiple slashes and dot-slashes
        norm_cmd = re.sub(r"/+", "/", cmd)
        while "/./" in norm_cmd:
            norm_cmd = norm_cmd.replace("/./", "/")

        for rule in RULES:
            if rule.pattern.search(norm_cmd) or rule.pattern.search(cmd):
                return True, rule

    # 2. Check for file tool modifications to QUAN DOANH boundary
    if payload and isinstance(payload, dict):
        tool_call = payload.get("toolCall") if isinstance(payload.get("toolCall"), dict) else {}
        tool_call_args = tool_call.get("args") if isinstance(tool_call.get("args"), dict) else {}
        tool_input = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}

        target_file = (
            tool_call_args.get("TargetFile")
            or tool_call_args.get("path")
            or tool_call_args.get("file_path")
            or tool_input.get("TargetFile")
            or tool_input.get("path")
            or tool_input.get("file_path")
            or payload.get("TargetFile")
            or payload.get("path")
            or payload.get("file_path")
        )
        if target_file and isinstance(target_file, str):
            norm_path = target_file.replace("\\", "/")
            norm_path = re.sub(r"/+", "/", norm_path)
            while "/./" in norm_path:
                norm_path = norm_path.replace("/./", "/")
            if QUAN_DOANH_PATH_PATTERN.search(norm_path) or QUAN_DOANH_PATH_PATTERN.search(target_file):
                rule = GuardrailRule(
                    rule_id="quan_doanh_file_mod",
                    category="quan_doanh_boundary",
                    name="QUAN DOANH Boundary File Modification",
                    pattern=QUAN_DOANH_PATH_PATTERN,
                    reason=f"Target file '{target_file}' is inside QUAN DOANH protected boundary.",
                    authority="boundary-check.cjs & HARNESS.md §2 Guardrails",
                )
                return True, rule

    return False, None


# =============================================================================
# Main Entry Point
# =============================================================================

def main() -> int:
    try:
        cmd, raw_text, payload = extract_command_and_context()

        # If no command or input detected, default allow (fail-open for empty)
        if not cmd and not payload:
            out = {"decision": "allow"}
            sys.stdout.write(json.dumps(out) + "\n")
            return 0

        # Check CEO Override
        if is_ceo_override(cmd, raw_text, sys.argv[1:], payload):
            out = {
                "decision": "allow",
                "reason": "Execution permitted under CEO override authority (--ceo-override or MEKONG_CEO_OVERRIDE=1).",
            }
            sys.stdout.write(json.dumps(out) + "\n")
            return 0

        # Check Rules
        blocked, rule = evaluate_guardrails(cmd, payload)
        if blocked and rule is not None:
            # Format block message
            reason_msg = (
                f"Mekong HARNESS Guardrail: {rule.name} blocked [{cmd or 'target modification'}]. "
                f"{rule.reason} Add '--ceo-override' or set MEKONG_CEO_OVERRIDE=1 to bypass."
            )
            out = {
                "decision": "deny",
                "reason": reason_msg,
            }
            sys.stdout.write(json.dumps(out) + "\n")

            # Structured warning banner to stderr
            stderr_msg = (
                f"\n🛡️  [MEKONG HARNESS GUARDRAIL TRIGGERED]\n"
                f"─────────────────────────────────────────────────────────────────────────\n"
                f"Violation:  {rule.name}\n"
                f"Offense:    {cmd or 'Target modification'}\n"
                f"Reason:     {rule.reason}\n"
                f"Authority:  {rule.authority}\n"
                f"Bypass:     Append '--ceo-override' or run with MEKONG_CEO_OVERRIDE=1\n"
                f"─────────────────────────────────────────────────────────────────────────\n"
            )
            sys.stderr.write(stderr_msg)
            return 1

        # Standard safe command pass-through
        out = {"decision": "allow"}
        sys.stdout.write(json.dumps(out) + "\n")
        return 0

    except Exception as e:
        # Internal hook failure fail-open guarantee to prevent bricking IDE
        sys.stderr.write(f"⚠️  [PreToolGuardrail Warning]: Internal error ({e}), failing open.\n")
        sys.stdout.write(json.dumps({"decision": "allow", "reason": str(e)}) + "\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
