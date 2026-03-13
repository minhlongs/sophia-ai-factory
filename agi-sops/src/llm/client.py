"""LLM Client - Ollama + MLX adapter"""

import os
from abc import ABC, abstractmethod
from collections.abc import Generator

from ..core.exceptions import LLMError


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""

    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        pass

    @abstractmethod
    def stream(self, prompt: str, **kwargs) -> Generator[str, None, None]:
        pass


class OllamaClient(LLMProvider):
    """Ollama LLM client"""

    def __init__(
        self,
        host: str = None,
        model: str = None,
        fallback_model: str = None,
    ):
        self.host = host or os.getenv("OLLAMA_HOST", "localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        self.fallback_model = fallback_model or os.getenv(
            "OLLAMA_FALLBACK_MODEL", "phi3:mini"
        )
        self._client = None

    def _get_client(self):
        """Lazy import ollama client"""
        if self._client is None:
            try:
                import ollama

                self._client = ollama.Client(host=f"http://{self.host}")
            except ImportError:
                raise LLMError("ollama package not installed", model=self.model)
        return self._client

    def generate(self, prompt: str, **kwargs) -> str:
        """Generate completion"""
        client = self._get_client()
        try:
            response = client.generate(model=self.model, prompt=prompt, **kwargs)
            return response["response"]
        except Exception as e:
            # Fallback to smaller model
            try:
                response = client.generate(model=self.fallback_model, prompt=prompt, **kwargs)
                return response["response"]
            except Exception:
                raise LLMError(f"Generation failed: {e}", model=self.model)

    def stream(self, prompt: str, **kwargs) -> Generator[str, None, None]:
        """Stream completion"""
        client = self._get_client()
        try:
            for chunk in client.generate(model=self.model, prompt=prompt, stream=True, **kwargs):
                yield chunk["response"]
        except Exception as e:
            raise LLMError(f"Streaming failed: {e}", model=self.model)


class LLMRouter:
    """Route requests to appropriate LLM provider"""

    def __init__(self):
        self.ollama = OllamaClient()
        self.use_mlx = os.getenv("USE_MLX", "false").lower() == "true"
        self.mlx_provider = None

        if self.use_mlx:
            try:
                self.mlx_provider = MLXProvider()
            except ImportError:
                self.use_mlx = False

    def generate(self, prompt: str, use_mlx: bool = None, **kwargs) -> str:
        """Generate with optional MLX"""
        if use_mlx is None:
            use_mlx = self.use_mlx

        if use_mlx and self.mlx_provider:
            return self.mlx_provider.generate(prompt, **kwargs)
        return self.ollama.generate(prompt, **kwargs)

    def stream(self, prompt: str, use_mlx: bool = None, **kwargs) -> Generator[str, None, None]:
        """Stream with optional MLX"""
        if use_mlx is None:
            use_mlx = self.use_mlx

        if use_mlx and self.mlx_provider:
            return self.mlx_provider.stream(prompt, **kwargs)
        return self.ollama.stream(prompt, **kwargs)


class MLXProvider(LLMProvider):
    """MLX provider for Apple Silicon"""

    def __init__(self, model: str = None):
        self.model = model or os.getenv("MLX_MODEL", "Qwen/Qwen2.5-7B-Instruct-4bit")
        self._model = None
        self._tokenizer = None

    def _load_model(self):
        """Lazy load MLX model"""
        if self._model is None:
            try:
                import mlx.core as mx
                from mlx_lm import load

                self._model, self._tokenizer = load(self.model)
            except ImportError:
                raise LLMError("mlx-lm package not installed", model=self.model)

    def generate(self, prompt: str, **kwargs) -> str:
        """Generate with MLX"""
        self._load_model()
        try:
            from mlx_lm import generate

            return generate(self._model, self._tokenizer, prompt=prompt, **kwargs)
        except Exception as e:
            raise LLMError(f"MLX generation failed: {e}", model=self.model)

    def stream(self, prompt: str, **kwargs) -> Generator[str, None, None]:
        """Stream with MLX"""
        self._load_model()
        try:
            from mlx_lm import generate

            # MLX doesn't support streaming natively
            # Return full generation as single chunk
            yield generate(self._model, self._tokenizer, prompt=prompt, **kwargs)
        except Exception as e:
            raise LLMError(f"MLX streaming failed: {e}", model=self.model)
