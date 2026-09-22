#!/usr/bin/env python3
"""
Adversarial Test Suite for Sophia AI Factory Local Deployment Guardrails.
Tests local deployment deprecation guard, break-glass protocol, CI bypass,
and edge/boundary tamper conditions across root wrapper and app scripts.
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "apps" / "sophia-ai-factory"
ROOT_SCRIPT = REPO_ROOT / "scripts" / "deploy-with-sha.sh"
APP_SCRIPT = APP_DIR / "scripts" / "deploy-with-sha.sh"

EXPECTED_ERROR_BANNER = (
    "❌ Local direct deployment is disabled to prevent bugs and environment drift.\n"
    "👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions."
)
EXPECTED_BREAK_GLASS_HEADER = "BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1"

tests_run = 0
tests_passed = 0
failures = []

def run_test(name, cmd, cwd, env_overrides, expected_code, expected_in_stdout=None, unexpected_in_stdout=None, expected_in_stderr=None):
    global tests_run, tests_passed, failures
    tests_run += 1
    
    # Base clean environment with CI vars cleared unless explicitly set
    env = os.environ.copy()
    for var in ["GITHUB_ACTIONS", "EMERGENCY_CF_DIRECT", "ALLOW_UNPUSHED_DEPLOY", "SKIP_TSC", "SKIP_TESTS"]:
        env.pop(var, None)
    env.update(env_overrides)
    
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15
        )
        
        passed = True
        error_reasons = []
        
        if proc.returncode != expected_code:
            passed = False
            error_reasons.append(f"Exit code {proc.returncode} != expected {expected_code}")
            
        combined_output = proc.stdout + "\n" + proc.stderr
        
        if expected_in_stdout:
            for item in expected_in_stdout:
                if item not in combined_output:
                    passed = False
                    error_reasons.append(f"Missing expected text in output: '{item}'")
                    
        if unexpected_in_stdout:
            for item in unexpected_in_stdout:
                if item in combined_output:
                    passed = False
                    error_reasons.append(f"Found unexpected text in output: '{item}'")
                    
        if expected_in_stderr:
            for item in expected_in_stderr:
                if item not in proc.stderr:
                    passed = False
                    error_reasons.append(f"Missing expected text in stderr: '{item}'")
                    
        if passed:
            tests_passed += 1
            print(f"  ✅ PASS: {name}")
        else:
            failures.append((name, error_reasons, proc.returncode, proc.stdout, proc.stderr))
            print(f"  ❌ FAIL: {name} -> {', '.join(error_reasons)}")
            
    except subprocess.TimeoutExpired:
        failures.append((name, ["Command timed out after 15s"], -1, "", ""))
        print(f"  ❌ TIMEOUT: {name}")
    except Exception as e:
        failures.append((name, [str(e)], -1, "", ""))
        print(f"  ❌ ERROR: {name} -> {e}")

def main():
    print(f"Starting Adversarial Guardrails Verification Suite")
    print(f"Target Scripts:\n - Root: {ROOT_SCRIPT}\n - App:  {APP_SCRIPT}\n")
    
    # --- Category 1: Baseline Guardrail Enforcement (Default Local Run) ---
    print("=== Category 1: Baseline Local Guardrail Enforcement ===")
    run_test(
        name="1A: Root wrapper without EMERGENCY_CF_DIRECT (fails with code 1 & guidance banner)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={},
        expected_code=1,
        expected_in_stdout=[
            "❌ Local direct deployment is disabled to prevent bugs and environment drift.",
            "👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions."
        ]
    )
    
    run_test(
        name="1B: App script from root without EMERGENCY_CF_DIRECT (fails with code 1 & guidance banner)",
        cmd=["bash", str(APP_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={},
        expected_code=1,
        expected_in_stdout=[
            "❌ Local direct deployment is disabled to prevent bugs and environment drift.",
            "👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions."
        ]
    )
    
    run_test(
        name="1C: App script from apps/ directory without EMERGENCY_CF_DIRECT (fails code 1)",
        cmd=["bash", str(APP_SCRIPT)],
        cwd=APP_DIR,
        env_overrides={},
        expected_code=1,
        expected_in_stdout=[
            "❌ Local direct deployment is disabled to prevent bugs and environment drift.",
            "👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions."
        ]
    )
    
    run_test(
        name="1D: Root wrapper with --help without EMERGENCY_CF_DIRECT (blocked before help)",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={},
        expected_code=1,
        expected_in_stdout=[
            "❌ Local direct deployment is disabled to prevent bugs and environment drift."
        ],
        unexpected_in_stdout=[
            "Usage: ./scripts/deploy-with-sha.sh"
        ]
    )
    
    # --- Category 2: Break-Glass Protocol Active (EMERGENCY_CF_DIRECT=1) ---
    print("\n=== Category 2: Break-Glass Protocol Active ===")
    run_test(
        name="2A: Root wrapper with EMERGENCY_CF_DIRECT=1 and --help (exits 0 with warning banner)",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=[
            "⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1",
            "⚠️ Bypassing CI/CD requirement for local direct deployment to Cloudflare edge.",
            "⚠️ Operator:",
            "⚠️ Ensure all quality gates have passed locally before proceeding!",
            "Usage: ./scripts/deploy-with-sha.sh"
        ],
        unexpected_in_stdout=[
            "❌ Local direct deployment is disabled to prevent bugs and environment drift."
        ]
    )
    
    run_test(
        name="2B: App script with EMERGENCY_CF_DIRECT=1 and --help",
        cmd=["bash", str(APP_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=[
            "⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1",
            "Usage: ./scripts/deploy-with-sha.sh"
        ]
    )
    
    run_test(
        name="2C: App script inside app dir with EMERGENCY_CF_DIRECT=1 and -h",
        cmd=["bash", "./scripts/deploy-with-sha.sh", "-h"],
        cwd=APP_DIR,
        env_overrides={"EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=[
            "⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1",
            "Usage: ./scripts/deploy-with-sha.sh"
        ]
    )
    
    # --- Category 3: GitHub Actions CI Simulation (GITHUB_ACTIONS=true) ---
    print("\n=== Category 3: GitHub Actions CI Simulation ===")
    run_test(
        name="3A: GITHUB_ACTIONS=true bypasses local guard without break-glass banner",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "true"},
        expected_code=0,
        expected_in_stdout=[
            "Usage: ./scripts/deploy-with-sha.sh"
        ],
        unexpected_in_stdout=[
            "BREAK-GLASS PROTOCOL ACTIVE",
            "❌ Local direct deployment is disabled"
        ]
    )
    
    run_test(
        name="3B: App script with GITHUB_ACTIONS=true bypasses guard cleanly",
        cmd=["bash", str(APP_SCRIPT), "--help"],
        cwd=APP_DIR,
        env_overrides={"GITHUB_ACTIONS": "true"},
        expected_code=0,
        expected_in_stdout=[
            "Usage: ./scripts/deploy-with-sha.sh"
        ],
        unexpected_in_stdout=[
            "BREAK-GLASS PROTOCOL ACTIVE",
            "❌ Local direct deployment is disabled"
        ]
    )
    
    # --- Category 4: Adversarial Tamper Probes & Edge Conditions ---
    print("\n=== Category 4: Adversarial Tamper Probes & Edge Conditions ===")
    run_test(
        name="4A: EMERGENCY_CF_DIRECT=0 (must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "0"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4B: EMERGENCY_CF_DIRECT=true (must remain blocked - strict string 1 required)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "true"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4C: EMERGENCY_CF_DIRECT='' (empty string must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": ""},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4D: EMERGENCY_CF_DIRECT=2 (non-1 integer must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "2"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4E: EMERGENCY_CF_DIRECT=-1 (negative integer must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "-1"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4F: EMERGENCY_CF_DIRECT=' 1 ' (padded with spaces must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": " 1 "},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4G: EMERGENCY_CF_DIRECT='1; echo injected' (shell injection attempt must fail safely)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"EMERGENCY_CF_DIRECT": "1; echo injected"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"],
        unexpected_in_stdout=["injected"]
    )
    
    run_test(
        name="4H: GITHUB_ACTIONS=false (must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "false"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4I: GITHUB_ACTIONS=0 (must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "0"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4J: GITHUB_ACTIONS=1 (must remain blocked - requires 'true')",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "1"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4K: GITHUB_ACTIONS=TRUE (uppercase must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "TRUE"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="4L: GITHUB_ACTIONS=' true ' (spaced must remain blocked)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": " true "},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    # --- Category 5: Combined Matrix & Precedence ---
    print("\n=== Category 5: Combined Matrix & Precedence ===")
    run_test(
        name="5A: GITHUB_ACTIONS=false & EMERGENCY_CF_DIRECT=0 -> Blocked",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "false", "EMERGENCY_CF_DIRECT": "0"},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="5B: GITHUB_ACTIONS=false & EMERGENCY_CF_DIRECT=1 -> Break-glass active",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "false", "EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=["⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1"]
    )
    
    run_test(
        name="5C: GITHUB_ACTIONS=true & EMERGENCY_CF_DIRECT=0 -> CI takes precedence, no break-glass banner",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "true", "EMERGENCY_CF_DIRECT": "0"},
        expected_code=0,
        expected_in_stdout=["Usage: ./scripts/deploy-with-sha.sh"],
        unexpected_in_stdout=["BREAK-GLASS PROTOCOL ACTIVE"]
    )
    
    run_test(
        name="5D: GITHUB_ACTIONS=true & EMERGENCY_CF_DIRECT=1 -> CI takes precedence, no break-glass banner",
        cmd=["bash", str(ROOT_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        env_overrides={"GITHUB_ACTIONS": "true", "EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=["Usage: ./scripts/deploy-with-sha.sh"],
        unexpected_in_stdout=["BREAK-GLASS PROTOCOL ACTIVE"]
    )
    
    # --- Category 6: Working Directory Independence & Invocation Vectors ---
    print("\n=== Category 6: Invocation Vectors (npm & subdirectory) ===")
    run_test(
        name="6A: Root script invoked from /tmp (wrapper resolves REPO_ROOT correctly)",
        cmd=["bash", str(ROOT_SCRIPT)],
        cwd="/tmp",
        env_overrides={},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="6B: App script invoked from /tmp with EMERGENCY_CF_DIRECT=1 --help",
        cmd=["bash", str(APP_SCRIPT), "--help"],
        cwd="/tmp",
        env_overrides={"EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=["⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1"]
    )
    
    # In sandbox environment, invoking npm directly via #!/usr/bin/env node can hit macOS sandbox restrictions,
    # so we invoke via `node /opt/homebrew/bin/npm` or fallback to `npm`.
    npm_cmd = ["node", "/opt/homebrew/bin/npm"] if os.path.exists("/opt/homebrew/bin/npm") else ["npm"]

    run_test(
        name="6C: npm run deploy:full without flag from apps/sophia-ai-factory",
        cmd=npm_cmd + ["run", "deploy:full"],
        cwd=APP_DIR,
        env_overrides={},
        expected_code=1,
        expected_in_stdout=["❌ Local direct deployment is disabled"]
    )
    
    run_test(
        name="6D: npm run deploy:full with EMERGENCY_CF_DIRECT=1 -- --help",
        cmd=npm_cmd + ["run", "deploy:full", "--", "--help"],
        cwd=APP_DIR,
        env_overrides={"EMERGENCY_CF_DIRECT": "1"},
        expected_code=0,
        expected_in_stdout=[
            "⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1",
            "Usage: ./scripts/deploy-with-sha.sh"
        ]
    )


    print("\n" + "=" * 60)
    print(f"RESULTS: {tests_passed} / {tests_run} tests passed ({(tests_passed/tests_run)*100:.1f}%)")
    print("=" * 60)
    
    if failures:
        print("\nFAILURE SUMMARY:")
        for name, reasons, code, out, err in failures:
            print(f"- {name}:")
            for r in reasons:
                print(f"    * {r}")
        sys.exit(1)
    else:
        print("\nALL ADVERSARIAL TESTS PASSED EMPIRICALLY!")
        sys.exit(0)

if __name__ == "__main__":
    main()
