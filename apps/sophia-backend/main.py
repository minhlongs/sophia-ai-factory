"""
Sophia AI Factory - FastAPI Backend
AI-powered proposal generation with brand voice RAG
"""

import os
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .ai_client import ai_client, AIClient
from .brand_voice import brand_voice_manager, BrandVoiceManager
from .proposal_generator import proposal_generator, ProposalGenerator

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Sophia AI Factory API",
    description="AI-powered proposal generation with brand voice RAG",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sophia-factory.vercel.app",
        "https://sophia.agencyos.network"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Request/Response Models ==============

class GenerateEmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text to generate embedding for")


class GenerateEmbeddingResponse(BaseModel):
    embedding: List[float]
    dimensions: int = 1536


class StoreBrandVoiceRequest(BaseModel):
    org_id: str
    content: str
    characteristics: Optional[Dict[str, Any]] = None


class StoreTrainingDocumentRequest(BaseModel):
    org_id: str
    file_name: str
    file_url: str
    content_text: str
    file_type: str = "text/plain"


class RetrieveDocumentsRequest(BaseModel):
    org_id: str
    query: str
    match_threshold: float = 0.7
    match_count: int = 5


class GenerateProposalRequest(BaseModel):
    org_id: str
    title: str
    client_name: str
    project_brief: str
    requirements: List[str]
    budget_range: Optional[str] = None
    timeline_preference: Optional[str] = None


class RefineSectionRequest(BaseModel):
    org_id: str
    section_type: str
    existing_content: str
    feedback: str


class HealthResponse(BaseModel):
    status: str
    version: str
    openai_connected: bool = False
    supabase_connected: bool = False


# ============== Health Check ==============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and external service connectivity."""
    health = HealthResponse(
        status="healthy",
        version="1.0.0"
    )

    # Check OpenAI connection
    try:
        ai_client.generate_embedding("test")
        health.openai_connected = True
    except Exception:
        health.openai_connected = False

    # Check Supabase connection
    try:
        brand_voice_manager.get_brand_voice("00000000-0000-0000-0000-000000000000")
        health.supabase_connected = True
    except Exception:
        health.supabase_connected = False

    return health


# ============== AI Client Endpoints ==============

@app.post("/ai/embeddings", response_model=GenerateEmbeddingResponse)
async def generate_embedding(request: GenerateEmbeddingRequest):
    """Generate embedding vector for text."""
    try:
        embedding = ai_client.generate_embedding(request.text)
        return GenerateEmbeddingResponse(
            embedding=embedding,
            dimensions=len(embedding)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate embedding"
        )


@app.post("/ai/generate")
async def generate_text(
    prompt: str,
    system_message: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096
):
    """Generate text using GPT-4."""
    try:
        response = ai_client.generate_text(
            prompt=prompt,
            system_message=system_message,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return {"content": response}
    except Exception as e:
        logger.error(f"Text generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate text"
        )


# ============== Brand Voice Endpoints ==============

@app.post("/brand-voice/store")
async def store_brand_voice(request: StoreBrandVoiceRequest):
    """Store brand voice embedding for an organization."""
    try:
        voice_id = brand_voice_manager.store_brand_voice_embedding(
            org_id=request.org_id,
            content=request.content,
            characteristics=request.characteristics
        )
        return {
            "id": voice_id,
            "status": "trained",
            "message": "Brand voice stored successfully"
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Store brand voice failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store brand voice"
        )


@app.get("/brand-voice/{org_id}")
async def get_brand_voice(org_id: str):
    """Get brand voice for an organization."""
    try:
        brand_voice = brand_voice_manager.get_brand_voice(org_id)
        if not brand_voice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brand voice not found"
            )
        return brand_voice
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get brand voice failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve brand voice"
        )


@app.post("/training-documents/store")
async def store_training_document(request: StoreTrainingDocumentRequest):
    """Store a training document with embedding."""
    try:
        doc_id = brand_voice_manager.store_training_document(
            org_id=request.org_id,
            file_name=request.file_name,
            file_url=request.file_url,
            content_text=request.content_text,
            file_type=request.file_type
        )
        return {
            "id": doc_id,
            "status": "processed",
            "message": "Training document stored successfully"
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Store training document failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store training document"
        )


@app.get("/training-documents/{org_id}")
async def get_training_documents(org_id: str):
    """Get all training documents for an organization."""
    try:
        documents = brand_voice_manager.get_training_documents(org_id)
        return {"documents": documents, "count": len(documents)}
    except Exception as e:
        logger.error(f"Get training documents failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve training documents"
        )


@app.post("/brand-voice/search")
async def search_similar_documents(request: RetrieveDocumentsRequest):
    """Search for similar documents using RAG."""
    try:
        results = brand_voice_manager.retrieve_similar_documents(
            org_id=request.org_id,
            query=request.query,
            match_threshold=request.match_threshold,
            match_count=request.match_count
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Document search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search documents"
        )


# ============== Proposal Generation Endpoints ==============

@app.post("/proposals/generate")
async def generate_proposal(request: GenerateProposalRequest):
    """Generate a complete proposal with all sections."""
    try:
        proposal = proposal_generator.generate_full_proposal(
            org_id=request.org_id,
            title=request.title,
            client_name=request.client_name,
            project_brief=request.project_brief,
            requirements=request.requirements,
            budget_range=request.budget_range,
            timeline_preference=request.timeline_preference
        )
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Proposal generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate proposal"
        )


@app.post("/proposals/outline")
async def generate_proposal_outline(
    project_brief: str,
    requirements: List[str]
):
    """Generate a proposal outline."""
    try:
        outline = proposal_generator.generate_proposal_outline(
            project_brief=project_brief,
            requirements=requirements
        )
        return {"outline": outline}
    except Exception as e:
        logger.error(f"Outline generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate outline"
        )


@app.post("/proposals/refine")
async def refine_section(request: RefineSectionRequest):
    """Refine a proposal section based on feedback."""
    try:
        refined = proposal_generator.refine_section(
            org_id=request.org_id,
            section_type=request.section_type,
            existing_content=request.existing_content,
            feedback=request.feedback
        )
        return {
            "section_type": request.section_type,
            "content": refined,
            "message": "Section refined successfully"
        }
    except Exception as e:
        logger.error(f"Section refinement failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refine section"
        )


# ============== Root Endpoint ==============

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Sophia AI Factory API",
        "version": "1.0.0",
        "description": "AI-powered proposal generation with brand voice RAG",
        "endpoints": {
            "health": "/health",
            "ai": "/ai/embeddings, /ai/generate",
            "brand_voice": "/brand-voice/*",
            "training_documents": "/training-documents/*",
            "proposals": "/proposals/generate, /proposals/outline, /proposals/refine"
        }
    }


# ============== Main Entry Point ==============

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
