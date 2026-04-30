"""
Sophia AI Factory Backend
FastAPI server for AI-powered proposal generation
"""

from .main import app
from .ai_client import AIClient, ai_client
from .brand_voice import BrandVoiceManager, brand_voice_manager
from .proposal_generator import ProposalGenerator, proposal_generator

__all__ = [
    "app",
    "AIClient",
    "ai_client",
    "BrandVoiceManager",
    "brand_voice_manager",
    "ProposalGenerator",
    "proposal_generator",
]
