"""Tests for PEV Engine"""


from src.core.engine import Executor, PEVEngine, Verifier
from src.core.models import SOP, QualityGate, SOPStep


class TestExecutor:
    """Test Step Executor"""

    def test_execute_success(self):
        """Test successful step execution"""
        step = SOPStep(
            id="test",
            command="echo hello",
            timeout=10,
        )

        executor = Executor()
        success, output = executor.execute_step(step)

        assert success is True
        assert "hello" in output
        assert step.status.value == "success"
        assert step.duration_ms is not None

    def test_execute_failure(self):
        """Test failed step execution"""
        step = SOPStep(
            id="test",
            command="exit 1",
            timeout=10,
        )

        executor = Executor()
        success, output = executor.execute_step(step)

        assert success is False
        assert step.status.value == "failed"

    def test_execute_timeout(self):
        """Test step timeout"""
        step = SOPStep(
            id="test",
            command="sleep 5",
            timeout=1,
        )

        executor = Executor()
        success, output = executor.execute_step(step)

        assert success is False
        assert "Timeout" in step.error


class TestVerifier:
    """Test Step Verifier"""

    def test_validate_success(self):
        """Test successful validation"""
        step = SOPStep(
            id="test",
            command="echo hello",
            validation="exit 0",  # Simple validation that always passes
        )

        verifier = Verifier()
        # First execute
        executor = Executor()
        executor.execute_step(step)

        # Then validate
        valid = verifier.validate_step(step)
        assert valid is True

    def test_validate_exit_code_equals(self):
        """Test exit_code == 0 validation"""
        verifier = Verifier()

        # Test exit_code == 0
        assert verifier._evaluate_validation("exit_code == 0", exit_code=0) is True
        assert verifier._evaluate_validation("exit_code == 0", exit_code=1) is False

        # Test exit_code != 0
        assert verifier._evaluate_validation("exit_code != 0", exit_code=1) is True
        assert verifier._evaluate_validation("exit_code != 0", exit_code=0) is False

        # Test exit_code == N
        assert verifier._evaluate_validation("exit_code == 1", exit_code=1) is True
        assert verifier._evaluate_validation("exit_code == 2", exit_code=1) is False

    def test_validate_output_contains(self):
        """Test output_contains validation"""
        verifier = Verifier()

        assert verifier._evaluate_validation(
            'output_contains("hello")',
            step_output="hello world"
        ) is True

        assert verifier._evaluate_validation(
            'output_contains("goodbye")',
            step_output="hello world"
        ) is False

    def test_validate_output_matches(self):
        """Test output_matches regex validation"""
        verifier = Verifier()

        # Test with digit pattern
        assert verifier._evaluate_validation(
            'output_matches("[0-9]+")',
            step_output="version 1.2.3"
        ) is True

        # Test with start anchor
        assert verifier._evaluate_validation(
            'output_matches("^hello")',
            step_output="hello world"
        ) is True

        assert verifier._evaluate_validation(
            'output_matches("^goodbye")',
            step_output="hello world"
        ) is False

    def test_validate_len_output(self):
        """Test len(output) validation"""
        verifier = Verifier()

        assert verifier._evaluate_validation(
            "len(output) > 0",
            step_output="not empty"
        ) is True

        assert verifier._evaluate_validation(
            "len(output) > 0",
            step_output=""
        ) is False

        assert verifier._evaluate_validation(
            "len(output) >= 5",
            step_output="hello"
        ) is True

        assert verifier._evaluate_validation(
            "len(output) < 3",
            step_output="hi"
        ) is True

    def test_quality_gates(self):
        """Test quality gate validation"""
        sop = SOP(
            name="test",
            version="1.0.0",
            description="Test",
            quality_gates=[
                QualityGate(name="check1", check="echo ok"),
                QualityGate(name="check2", check="exit 0"),
            ],
        )

        verifier = Verifier()
        results = verifier.validate_quality_gates(sop)

        assert len(results) == 2
        assert results[0][1] is True  # check1 passed
        assert results[1][1] is True  # check2 passed


class TestPEVEngine:
    """Test PEV Engine"""

    def test_execute_sop_success(self):
        """Test successful SOP execution"""
        sop = SOP(
            name="test-sop",
            version="1.0.0",
            description="Test SOP",
            steps=[
                SOPStep(id="step1", command="echo step1"),
                SOPStep(id="step2", command="echo step2"),
            ],
        )

        engine = PEVEngine()
        result = engine.execute_sop(sop)

        assert result.success is True
        assert result.steps_completed == 2
        assert result.steps_failed == 0

    def test_execute_sop_failure(self):
        """Test SOP execution with failure"""
        sop = SOP(
            name="test-sop",
            version="1.0.0",
            description="Test SOP",
            steps=[
                SOPStep(id="step1", command="echo step1"),
                SOPStep(id="step2", command="exit 1"),  # This will fail
                SOPStep(id="step3", command="echo step3"),
            ],
        )

        engine = PEVEngine()
        result = engine.execute_sop(sop)

        assert result.success is False
        assert result.steps_failed >= 1
        # step3 should be skipped
        assert result.steps_completed == 1

    def test_execute_sop_with_rollback(self):
        """Test SOP execution with rollback"""
        sop = SOP(
            name="test-sop",
            version="1.0.0",
            description="Test SOP",
            steps=[
                SOPStep(
                    id="step1",
                    command="exit 1",
                    rollback="echo rollback executed",
                ),
            ],
        )

        engine = PEVEngine()
        result = engine.execute_sop(sop)

        assert result.success is False
        # Rollback should have been executed (no exception)
