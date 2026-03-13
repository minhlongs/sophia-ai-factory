"""Data models for AGI SOPs"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class SOPStep:
    """Single step in an SOP"""

    id: str
    command: str
    timeout: int = 120
    validation: Optional[str] = None
    rollback: Optional[str] = None
    description: Optional[str] = None
    status: StepStatus = StepStatus.PENDING
    output: Optional[str] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None


@dataclass
class QualityGate:
    """Quality gate for validation"""

    name: str
    check: str
    description: Optional[str] = None
    passed: Optional[bool] = None
    message: Optional[str] = None


@dataclass
class SOP:
    """Standard Operating Procedure"""

    name: str
    version: str
    description: str
    steps: list[SOPStep] = field(default_factory=list)
    quality_gates: list[QualityGate] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class ExecutionResult:
    """Result of SOP execution"""

    success: bool
    status: ExecutionStatus
    sop_name: str
    steps_completed: int = 0
    steps_failed: int = 0
    steps_skipped: int = 0
    duration_ms: Optional[int] = None
    error: Optional[str] = None
    outputs: dict = field(default_factory=dict)
    rollback_performed: bool = False
