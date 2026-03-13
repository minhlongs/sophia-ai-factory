"""AGI SOPs Core Engine Exceptions"""


class MekongError(Exception):
    """Base exception for AGI SOPs"""

    def __init__(self, message: str, code: str = None, details: dict = None):
        self.message = message
        self.code = code or "UNKNOWN_ERROR"
        self.details = details or {}
        super().__init__(self.message)


class SOPNotFoundError(MekongError):
    """SOP not found"""

    def __init__(self, name: str):
        super().__init__(
            message=f"SOP '{name}' not found",
            code="SOP_NOT_FOUND",
            details={"sop_name": name},
        )


class SOPValidationError(MekongError):
    """SOP validation failed"""

    def __init__(self, errors: list):
        super().__init__(
            message="SOP validation failed",
            code="SOP_VALIDATION_ERROR",
            details={"errors": errors},
        )


class LLMError(MekongError):
    """LLM inference error"""

    def __init__(self, message: str, model: str = None):
        super().__init__(
            message=message,
            code="LLM_ERROR",
            details={"model": model},
        )


class ExecutionError(MekongError):
    """Step execution failed"""

    def __init__(self, step_id: str, error: str, output: str = None):
        super().__init__(
            message=f"Step '{step_id}' failed: {error}",
            code="EXECUTION_ERROR",
            details={"step_id": step_id, "output": output},
        )


class ValidationError(MekongError):
    """Quality gate validation failed"""

    def __init__(self, gate_name: str, expected: str, actual: str):
        super().__init__(
            message=f"Quality gate '{gate_name}' failed",
            code="VALIDATION_ERROR",
            details={"gate_name": gate_name, "expected": expected, "actual": actual},
        )
