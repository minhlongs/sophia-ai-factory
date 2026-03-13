"""Tests for CLI Commands"""

from typer.testing import CliRunner

from src.cli.main import app

runner = CliRunner()


class TestCLI:
    """Test CLI Commands"""

    def test_version(self):
        """Test version command"""
        result = runner.invoke(app, ["version"])
        assert result.exit_code == 0
        assert "agi-sops" in result.stdout
        assert "v0.1.0" in result.stdout

    def test_help(self):
        """Test help command"""
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "AGI SOPs" in result.stdout
        assert "cook" in result.stdout
        assert "plan" in result.stdout
        assert "run" in result.stdout
        assert "sop" in result.stdout

    def test_sop_list_empty(self):
        """Test sop list with no SOPs"""
        result = runner.invoke(app, ["sop", "list"])
        assert result.exit_code == 0

    def test_sop_new(self, tmp_path, monkeypatch):
        """Test creating new SOP"""
        monkeypatch.chdir(tmp_path)

        result = runner.invoke(app, ["sop", "new", "test-sop"])
        assert result.exit_code == 0
        assert "Created SOP" in result.stdout

        # Verify file created
        sop_file = tmp_path / "sops" / "procedures" / "test-sop" / "1.0.0" / "sop.yaml"
        assert sop_file.exists()

    def test_cook_dry_run(self):
        """Test cook command with dry run"""
        result = runner.invoke(app, ["cook", "test goal", "--dry-run"])
        assert result.exit_code == 0
        assert "Dry run" in result.stdout

    def test_plan(self):
        """Test plan command"""
        result = runner.invoke(app, ["plan", "test goal"])
        # Plan calls LLM which might fail if Ollama not running
        # Just check it runs without crashing
        assert result.exit_code == 0
