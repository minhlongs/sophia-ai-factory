"""SOP Parser - Parse YAML/Markdown SOP definitions"""

from pathlib import Path

import yaml

from ..core.exceptions import SOPValidationError
from ..core.models import SOP, QualityGate, SOPStep


class SOPParser:
    """Parse SOP definitions from YAML"""

    REQUIRED_FIELDS = ["name", "version", "description", "steps"]
    STEP_REQUIRED_FIELDS = ["id", "command"]

    def parse(self, content: str) -> SOP:
        """Parse YAML content into SOP object"""
        try:
            data = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise SOPValidationError(errors=[f"YAML parse error: {e}"])

        self._validate(data)

        steps = [self._parse_step(s) for s in data.get("steps", [])]
        quality_gates = [self._parse_gate(g) for g in data.get("quality_gates", [])]

        return SOP(
            name=data["name"],
            version=str(data["version"]),
            description=data["description"],
            steps=steps,
            quality_gates=quality_gates,
            metadata={k: v for k, v in data.items() if k not in self.REQUIRED_FIELDS},
        )

    def parse_file(self, path: Path) -> SOP:
        """Parse SOP from file"""
        content = path.read_text()
        sop = self.parse(content)
        return sop

    def _validate(self, data: dict) -> None:
        """Validate SOP structure"""
        errors = []

        for field in self.REQUIRED_FIELDS:
            if field not in data:
                errors.append(f"Missing required field: {field}")

        if "steps" in data:
            for i, step in enumerate(data["steps"]):
                for field in self.STEP_REQUIRED_FIELDS:
                    if field not in step:
                        errors.append(f"Step {i}: missing required field '{field}'")

        if errors:
            raise SOPValidationError(errors=errors)

    def _parse_step(self, data: dict) -> SOPStep:
        """Parse single step"""
        return SOPStep(
            id=data["id"],
            command=data["command"],
            timeout=data.get("timeout", 120),
            validation=data.get("validation"),
            rollback=data.get("rollback"),
            description=data.get("description"),
        )

    def _parse_gate(self, data: dict) -> QualityGate:
        """Parse quality gate"""
        return QualityGate(
            name=data["name"],
            check=data["check"],
            description=data.get("description"),
        )

    def to_yaml(self, sop: SOP) -> str:
        """Convert SOP to YAML string"""
        data = {
            "name": sop.name,
            "version": sop.version,
            "description": sop.description,
            "steps": [
                {
                    "id": s.id,
                    "command": s.command,
                    "timeout": s.timeout,
                    "validation": s.validation,
                    "rollback": s.rollback,
                    "description": s.description,
                }
                for s in sop.steps
            ],
        }

        if sop.quality_gates:
            data["quality_gates"] = [
                {"name": g.name, "check": g.check, "description": g.description}
                for g in sop.quality_gates
            ]

        return yaml.dump(data, default_flow_style=False, sort_keys=False)
