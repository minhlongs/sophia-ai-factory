# Code Standards - AGI SOPs Local LLM

**Version:** 0.1.0 | **Date:** 2026-03-12

---

## Python Version

- **Minimum:** Python 3.9
- **Target:** Python 3.10+
- **Type:** Full type hints required

---

## Code Style

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | snake_case | `sop_name`, `execution_result` |
| Functions | snake_case | `execute_step()`, `validate_sop()` |
| Classes | PascalCase | `SOPParser`, `PEVEngine` |
| Constants | UPPER_SNAKE | `MAX_TIMEOUT`, `DEFAULT_MODEL` |
| Private | leading underscore | `_internal_method()`, `_cache` |
| Files | kebab-case | `sop-parser.py`, `pev-engine.py` |

### Line Length

- **Maximum:** 100 characters
- **Tool:** black, ruff

### Imports

```python
# Standard library first
import os
import subprocess
from pathlib import Path
from typing import Optional, List

# Third-party packages
import typer
from rich.console import Console
import yaml

# Local imports
from ..core.models import SOP
from ..core.exceptions import SOPNotFoundError
```

---

## Type Hints

**Required for:**
- All function parameters
- All return types
- Class attributes

```python
# ✅ Good
def execute_step(step: SOPStep, timeout: int = 120) -> tuple[bool, str]:
    pass

class SOPParser:
    REQUIRED_FIELDS: list[str] = ["name", "version"]

    def parse(self, content: str) -> SOP:
        pass

# ❌ Bad - missing type hints
def execute_step(step, timeout=120):
    pass
```

---

## Error Handling

### Custom Exceptions

```python
# src/core/exceptions.py
class MekongError(Exception):
    """Base exception"""
    def __init__(self, message: str, code: str = None, details: dict = None):
        self.message = message
        self.code = code or "UNKNOWN_ERROR"
        self.details = details or {}
        super().__init__(self.message)

class SOPNotFoundError(MekongError):
    def __init__(self, name: str):
        super().__init__(
            message=f"SOP '{name}' not found",
            code="SOP_NOT_FOUND",
            details={"sop_name": name},
        )
```

### Try-Except Pattern

```python
# ✅ Good - specific exceptions
try:
    sop = storage.load(name)
except SOPNotFoundError:
    console.print(f"[red]SOP not found: {name}[/red]")
except yaml.YAMLError as e:
    console.print(f"[red]Invalid YAML: {e}[/red]")
except Exception as e:
    console.print(f"[red]Unexpected error: {e}[/red]")
    raise

# ❌ Bad - bare except
try:
    sop = storage.load(name)
except:
    print("Error")
```

---

## Documentation

### Docstrings

```python
class PEVEngine:
    """Plan-Execute-Verify Engine for SOP execution.

    Attributes:
        planner: LLM-powered plan generator
        executor: Step executor with timeout handling
        verifier: Output validator and quality gates
        cwd: Working directory for command execution
    """

    def execute_sop(self, sop: SOP, on_step_complete: Callable = None) -> ExecutionResult:
        """Execute SOP with PEV loop.

        Args:
            sop: SOP to execute
            on_step_complete: Callback after each step

        Returns:
            ExecutionResult with success status and outputs

        Raises:
            ExecutionError: If step execution fails
            ValidationError: If quality gates fail
        """
        pass
```

### Code Comments

```python
# ✅ Good - explains WHY, not WHAT
# Use phi3:mini as fallback for faster response times
# when qwen2.5:7b is unavailable or rate-limited
self.fallback_model = "phi3:mini"

# ❌ Bad - redundant
# Set the model name
self.model = "qwen2.5:7b"
```

---

## Testing

### Test Structure

```python
"""Tests for SOP Parser"""

import pytest
from src.sops.parser import SOPParser
from src.core.exceptions import SOPValidationError


class TestSOPParser:
    """Test SOP Parser"""

    def setup_method(self):
        """Setup test fixtures"""
        self.parser = SOPParser()

    def test_parse_valid_sop(self):
        """Test parsing valid SOP"""
        yaml_content = """
name: test-sop
version: 1.0.0
description: Test SOP

steps:
  - id: step1
    command: echo hello
"""
        sop = self.parser.parse(yaml_content)

        assert sop.name == "test-sop"
        assert len(sop.steps) == 1
```

### Test Naming

- **Pattern:** `test_<function>_<scenario>_<expected>`
- **Examples:**
  - `test_parse_valid_sop()`
  - `test_execute_step_timeout()`
  - `test_validate_quality_gates_all_pass()`

### Fixtures

```python
@pytest.fixture
def sample_sop():
    """Create sample SOP for testing"""
    return SOP(
        name="test-sop",
        version="1.0.0",
        description="Test SOP",
        steps=[SOPStep(id="s1", command="echo test")],
    )
```

---

## Git Workflow

### Commit Messages

```bash
# Format: <type>: <description>
feat: add RAG search functionality
fix: handle timeout in step executor
refactor: simplify PEV engine logic
docs: update architecture diagram
test: add integration tests for LLM client
chore: update dependencies
```

### Branch Naming

- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `refactor/<name>` - Code refactoring
- `docs/<name>` - Documentation updates

---

## Code Review Checklist

- [ ] Type hints complete
- [ ] Docstrings for public APIs
- [ ] Error handling appropriate
- [ ] Tests added/updated
- [ ] No hardcoded values
- [ ] Logging for debugging
- [ ] Security considerations addressed
- [ ] Performance impact evaluated

---

## Tools Configuration

### pyproject.toml

```toml
[tool.black]
line-length = 100
target-version = ["py39", "py310", "py311"]

[tool.ruff]
line-length = 100
select = ["E", "F", "W", "I", "N", "UP", "B", "C4"]

[tool.mypy]
python_version = "3.9"
strict = true
warn_return_any = true
warn_unused_ignores = true
```

### Pre-commit Hooks

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.0
    hooks:
      - id: black

  - repo: https://github.com/astral-sh/ruff
    rev: v0.1.8
    hooks:
      - id: ruff

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
```

---

## Performance Guidelines

1. **Lazy Loading:** Defer expensive imports
2. **Caching:** Cache LLM responses when possible
3. **Batch Operations:** Batch database writes
4. **Timeout:** Always set timeouts for external calls
5. **Streaming:** Use streaming for long LLM responses

---

## Security Guidelines

1. **Input Validation:** Validate all SOP YAML inputs
2. **Command Sanitization:** No shell injection vulnerabilities
3. **Secrets Management:** Use environment variables
4. **Least Privilege:** Run with minimal permissions
5. **Audit Logging:** Log all SOP executions
