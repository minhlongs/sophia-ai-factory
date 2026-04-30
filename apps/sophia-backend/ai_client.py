"""
OpenAI Client for Sophia AI Factory
Handles embeddings and GPT-4 generation
"""

import os
from openai import OpenAI
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()


class AIClient:
    """OpenAI client for embeddings and text generation."""

    def __init__(self):
        """Initialize OpenAI client."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")

        self.client = OpenAI(api_key=api_key)
        self.embedding_model = "text-embedding-ada-002"
        self.chat_model = "gpt-4-turbo-preview"

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for text.

        Args:
            text: Input text to embed

        Returns:
            List of floats representing the embedding vector (1536 dimensions)
        """
        try:
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding: {str(e)}")

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of input texts

        Returns:
            List of embedding vectors
        """
        try:
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            raise RuntimeError(f"Failed to generate batch embeddings: {str(e)}")

    def generate_text(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """
        Generate text using GPT-4.

        Args:
            prompt: User prompt
            system_message: Optional system message
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text response
        """
        try:
            messages = []

            if system_message:
                messages.append({"role": "system", "content": system_message})

            messages.append({"role": "user", "content": prompt})

            response = self.client.chat.completions.create(
                model=self.chat_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )

            return response.choices[0].message.content or ""
        except Exception as e:
            raise RuntimeError(f"Failed to generate text: {str(e)}")

    def generate_proposal_section(
        self,
        section_type: str,
        context: str,
        brand_voice: Optional[str] = None,
        client_info: Optional[dict] = None
    ) -> str:
        """
        Generate a specific proposal section.

        Args:
            section_type: Type of section (executive_summary, approach, timeline, etc.)
            context: Project context and requirements
            brand_voice: Optional brand voice characteristics
            client_info: Optional client information

        Returns:
            Generated section content
        """
        system_message = "You are an expert proposal writer for a digital agency. "

        if brand_voice:
            system_message += f"Write in this brand voice: {brand_voice}. "

        system_message += "Be professional, persuasive, and client-focused."

        prompt = f"""Generate a {section_type} section for a proposal.

Project Context:
{context}

"""

        if client_info:
            prompt += f"""Client Information:
- Client Name: {client_info.get('name', 'N/A')}
- Industry: {client_info.get('industry', 'N/A')}
- Pain Points: {', '.join(client_info.get('pain_points', []))}

"""

        prompt += f"""Generate compelling, specific content for the {section_type} section.
Focus on value delivery and outcomes, not just features."""

        return self.generate_text(
            prompt=prompt,
            system_message=system_message,
            temperature=0.7
        )


# Global client instance
ai_client = AIClient()
