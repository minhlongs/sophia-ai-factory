"""Tests for SOP Parser"""


import pytest

from src.core.exceptions import SOPValidationError
from src.sops.parser import SOPParser
from src.sops.storage import SOPStorage


class TestSOPParser:
    """Test SOP Parser"""

    def setup_method(self):
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
    timeout: 60
"""
        sop = self.parser.parse(yaml_content)

        assert sop.name == "test-sop"
        assert sop.version == "1.0.0"
        assert sop.description == "Test SOP"
        assert len(sop.steps) == 1
        assert sop.steps[0].id == "step1"
        assert sop.steps[0].command == "echo hello"

    def test_parse_missing_required_field(self):
        """Test parsing SOP with missing required field"""
        yaml_content = """
name: test-sop
version: 1.0.0
"""
        with pytest.raises(SOPValidationError):
            self.parser.parse(yaml_content)

    def test_parse_step_missing_command(self):
        """Test parsing step with missing command"""
        yaml_content = """
name: test-sop
version: 1.0.0
description: Test

steps:
  - id: step1
"""
        with pytest.raises(SOPValidationError):
            self.parser.parse(yaml_content)

    def test_parse_with_quality_gates(self):
        """Test parsing SOP with quality gates"""
        yaml_content = """
name: test-sop
version: 1.0.0
description: Test

steps:
  - id: step1
    command: echo hello

quality_gates:
  - name: gate1
    check: echo check
"""
        sop = self.parser.parse(yaml_content)

        assert len(sop.quality_gates) == 1
        assert sop.quality_gates[0].name == "gate1"

    def test_to_yaml(self):
        """Test converting SOP to YAML"""
        yaml_content = """
name: test-sop
version: 1.0.0
description: Test SOP

steps:
  - id: step1
    command: echo hello
    timeout: 60
"""
        sop = self.parser.parse(yaml_content)
        output = self.parser.to_yaml(sop)

        assert "name: test-sop" in output
        assert "version: 1.0.0" in output
        assert "command: echo hello" in output


class TestSOPStorage:
    """Test SOP Storage"""

    def test_save_and_load(self, tmp_path):
        """Test saving and loading SOP"""
        storage = SOPStorage(str(tmp_path / "sops"))
        yaml_content = """
name: test-sop
version: 1.0.0
description: Test SOP

steps:
  - id: step1
    command: echo hello
"""
        parser = SOPParser()
        sop = parser.parse(yaml_content)

        # Save
        storage.save(sop)

        # Load
        loaded = storage.load("test-sop")
        assert loaded.name == "test-sop"
        assert loaded.version == "1.0.0"

    def test_list_sops(self, tmp_path):
        """Test listing SOPs"""
        storage = SOPStorage(str(tmp_path / "sops"))
        yaml_content = """
name: {name}
version: 1.0.0
description: Test
steps:
  - id: s1
    command: echo test
"""
        parser = SOPParser()

        for name in ["sop-a", "sop-b"]:
            sop = parser.parse(yaml_content.format(name=name))
            storage.save(sop)

        sops = storage.list_sops()
        assert len(sops) == 2
        assert sops[0]["name"] == "sop-a"
        assert sops[1]["name"] == "sop-b"

    def test_load_not_found(self, tmp_path):
        """Test loading non-existent SOP"""
        storage = SOPStorage(str(tmp_path / "sops"))

        from src.core.exceptions import SOPNotFoundError

        with pytest.raises(SOPNotFoundError):
            storage.load("nonexistent")
