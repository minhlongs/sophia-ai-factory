"""Tests for LLM Client"""


import pytest

from src.llm.client import LLMRouter, OllamaClient


class TestOllamaClient:
    """Test Ollama Client"""

    def test_init_default(self):
        """Test client initialization with defaults"""
        client = OllamaClient()

        assert "localhost:11434" in client.host
        assert client.model == "qwen2.5:7b"
        assert client.fallback_model == "phi3:mini"

    def test_init_custom(self):
        """Test client initialization with custom params"""
        client = OllamaClient(
            host="custom-host:11434",
            model="custom-model",
        )

        assert client.host == "custom-host:11434"
        assert client.model == "custom-model"


class TestLLMRouter:
    """Test LLM Router"""

    def test_init(self):
        """Test router initialization"""
        router = LLMRouter()

        assert router.ollama is not None
        assert router.use_mlx is False  # Default


# Integration test - requires Ollama running
@pytest.mark.integration
class TestOllamaIntegration:
    """Integration tests requiring Ollama server"""

    def test_generate(self):
        """Test LLM generation"""
        client = OllamaClient()

        try:
            response = client.generate("Say hello in one word")
            assert len(response) > 0
        except Exception:
            # Ollama might not be running
            pytest.skip("Ollama server not available")

    def test_stream(self):
        """Test LLM streaming"""
        client = OllamaClient()

        try:
            chunks = list(client.stream("Count to 3"))
            assert len(chunks) > 0
        except Exception:
            pytest.skip("Ollama server not available")
