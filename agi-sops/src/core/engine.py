"""PEV Engine - Plan, Execute, Verify orchestrator"""

import subprocess
import time
from typing import Callable

from rich.console import Console

from ..core.models import SOP, ExecutionResult, ExecutionStatus, SOPStep, StepStatus
from ..llm.client import LLMRouter

console = Console()


class Planner:
    """Generate execution plans using LLM"""

    def __init__(self, llm_router: LLMRouter = None):
        self.llm = llm_router or LLMRouter()

    def generate_plan(self, goal: str, context: str = None) -> str:
        """Generate step-by-step plan for goal"""
        prompt = f"""You are an AGI SOPs planner. Generate a step-by-step plan to achieve this goal.

Goal: {goal}
{f"Context: {context}" if context else ""}

Output format:
1. [Step name] - Command to execute
2. [Step name] - Command to execute
...

Be specific and actionable. Include validation criteria for each step."""

        return self.llm.generate(prompt)


class Executor:
    """Execute SOP steps"""

    def __init__(self, cwd: str = None):
        self.cwd = cwd

    def execute_step(self, step: SOPStep) -> tuple[bool, str]:
        """Execute single step"""
        start_time = time.time()

        try:
            result = subprocess.run(
                step.command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=step.timeout,
                cwd=self.cwd,
            )

            duration_ms = int((time.time() - start_time) * 1000)
            step.output = result.stdout
            step.duration_ms = duration_ms

            if result.returncode != 0:
                step.status = StepStatus.FAILED
                step.error = result.stderr
                return False, result.stderr

            step.status = StepStatus.SUCCESS
            return True, result.stdout

        except subprocess.TimeoutExpired:
            step.status = StepStatus.FAILED
            step.error = f"Timeout after {step.timeout}s"
            return False, step.error
        except Exception as e:
            step.status = StepStatus.FAILED
            step.error = str(e)
            return False, step.error


class Verifier:
    """Validate execution results"""

    def __init__(self, cwd: str = None):
        self.cwd = cwd

    def validate_step(self, step: SOPStep) -> bool:
        """Validate step execution"""
        if not step.validation:
            return True

        # Execute validation command if it's a shell command
        validation_output = None
        exit_code = None

        try:
            result = subprocess.run(
                step.validation,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=self.cwd,
            )
            exit_code = result.returncode
            validation_output = result.stdout.strip()
        except Exception:
            # If command fails, try to evaluate as expression
            pass

        # Parse and evaluate validation expression
        return self._evaluate_validation(step.validation, exit_code, validation_output, step.output)

    def _evaluate_validation(self, expression: str, exit_code: int = None,
                            validation_output: str = None, step_output: str = None) -> bool:
        """Evaluate validation expression with support for:
        - exit_code == 0
        - exit_code != 0
        - output_contains("text")
        - output_matches("regex")
        - len(output) > 0
        """
        import re

        expression = expression.strip()

        # Handle exit_code comparisons
        if "exit_code" in expression:
            if expression == "exit_code == 0":
                return exit_code == 0
            elif expression == "exit_code != 0":
                return exit_code != 0
            elif expression.startswith("exit_code =="):
                try:
                    expected = int(expression.split("==")[1].strip())
                    return exit_code == expected
                except (ValueError, IndexError):
                    return False

        # Handle output_contains("text")
        match = re.match(r'output_contains\(["\'](.+?)["\']\)', expression)
        if match:
            search_text = match.group(1)
            return search_text in (step_output or "")

        # Handle output_matches("regex")
        match = re.match(r'output_matches\(["\'](.+?)["\']\)', expression)
        if match:
            pattern = match.group(1)
            return bool(re.search(pattern, step_output or ""))

        # Handle len(output) comparisons
        match = re.match(r'len\(output\)\s*(>|<|>=|<=|==|!=)\s*(\d+)', expression)
        if match:
            op = match.group(1)
            threshold = int(match.group(2))
            output_len = len(step_output or "")

            if op == ">": return output_len > threshold
            if op == "<": return output_len < threshold
            if op == ">=": return output_len >= threshold
            if op == "<=": return output_len <= threshold
            if op == "==": return output_len == threshold
            if op == "!=": return output_len != threshold

        # Default: check exit code
        return exit_code == 0 if exit_code is not None else False

    def validate_quality_gates(self, sop: SOP) -> list[tuple[str, bool]]:
        """Validate all quality gates"""
        results = []

        for gate in sop.quality_gates:
            try:
                result = subprocess.run(
                    gate.check,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    cwd=self.cwd,
                )
                passed = result.returncode == 0
                gate.passed = passed
                gate.message = result.stdout if passed else result.stderr
                results.append((gate.name, passed))
            except Exception as e:
                gate.passed = False
                gate.message = str(e)
                results.append((gate.name, False))

        return results


class PEVEngine:
    """Plan-Execute-Verify Engine"""

    def __init__(self, cwd: str = None):
        self.planner = Planner()
        self.executor = Executor(cwd)
        self.verifier = Verifier(cwd)
        self.cwd = cwd

    def execute_sop(self, sop: SOP, on_step_complete: Callable = None) -> ExecutionResult:
        """Execute SOP with PEV loop"""
        start_time = time.time()
        steps_completed = 0
        steps_failed = 0
        steps_skipped = 0
        outputs = {}

        console.print(f"\n[bold blue]Executing SOP:[/bold blue] {sop.name} v{sop.version}")

        for step in sop.steps:
            console.print(f"\n  [cyan]Step {step.id}:[/cyan] {step.command}")

            # Execute step
            success, output = self.executor.execute_step(step)

            if success:
                # Validate step
                if self.verifier.validate_step(step):
                    steps_completed += 1
                    step.status = StepStatus.SUCCESS
                    console.print(f"    [green]✓ Success[/green] ({step.duration_ms}ms)")
                else:
                    steps_failed += 1
                    step.status = StepStatus.FAILED
                    console.print("    [red]✗ Validation failed[/red]")
            else:
                steps_failed += 1
                step.status = StepStatus.FAILED
                console.print(f"    [red]✗ Failed: {step.error}[/red]")

                # Execute rollback if available
                if step.rollback:
                    console.print("    [yellow]Rolling back...[/yellow]")
                    subprocess.run(step.rollback, shell=True, cwd=self.cwd)

            outputs[step.id] = {"success": success, "output": output}

            if on_step_complete:
                on_step_complete(step)

            # Stop on failure (configurable)
            if not success:
                break

        duration_ms = int((time.time() - start_time) * 1000)

        # Validate quality gates if all steps passed
        quality_passed = True
        if steps_failed == 0 and sop.quality_gates:
            console.print("\n[bold]Quality Gates:[/bold]")
            gate_results = self.verifier.validate_quality_gates(sop)
            for name, passed in gate_results:
                icon = "✓" if passed else "✗"
                console.print(f"  {icon} {name}")
                if not passed:
                    quality_passed = False

        status = ExecutionStatus.SUCCESS if steps_failed == 0 and quality_passed else ExecutionStatus.FAILED

        return ExecutionResult(
            success=steps_failed == 0 and quality_passed,
            status=status,
            sop_name=sop.name,
            steps_completed=steps_completed,
            steps_failed=steps_failed,
            steps_skipped=steps_skipped,
            duration_ms=duration_ms,
            outputs=outputs,
        )
