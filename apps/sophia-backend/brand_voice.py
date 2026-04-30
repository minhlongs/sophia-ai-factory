"""
Brand Voice Management with pgvector RAG
Handles embedding storage and retrieval for brand voice matching
"""

import os
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

from .ai_client import ai_client

load_dotenv()


class BrandVoiceManager:
    """Manage brand voice embeddings and retrieval using pgvector."""

    def __init__(self):
        """Initialize Supabase client for brand voice storage."""
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not found in environment")

        self.supabase: Client = create_client(supabase_url, supabase_key)

    def store_brand_voice_embedding(
        self,
        org_id: str,
        content: str,
        characteristics: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store brand voice embedding for an organization.

        Args:
            org_id: Organization UUID
            content: Brand voice content text
            characteristics: Optional JSON characteristics of the brand voice

        Returns:
            Brand voice record ID
        """
        # Generate embedding
        embedding = ai_client.generate_embedding(content)

        # Upsert brand voice record
        data = {
            "org_id": org_id,
            "embedding": embedding,
            "voice_characteristics": characteristics or {},
            "model_status": "trained",
            "training_docs_count": 1
        }

        result = self.supabase.table("brand_voices").upsert(
            data,
            on_conflict="org_id"
        ).execute()

        return result.data[0]["id"]

    def store_training_document(
        self,
        org_id: str,
        file_name: str,
        file_url: str,
        content_text: str,
        file_type: str = "text/plain"
    ) -> str:
        """
        Store a training document with embedding.

        Args:
            org_id: Organization UUID
            file_name: Original file name
            file_url: Storage URL
            content_text: Extracted text content
            file_type: MIME type of the file

        Returns:
            Training document ID
        """
        # Generate embedding for document content
        embedding = ai_client.generate_embedding(content_text)

        # Insert training document
        data = {
            "org_id": org_id,
            "file_name": file_name,
            "file_url": file_url,
            "file_type": file_type,
            "content_text": content_text,
            "embedding": embedding,
            "processed": True
        }

        result = self.supabase.table("training_documents").insert(data).execute()
        return result.data[0]["id"]

    def retrieve_similar_documents(
        self,
        org_id: str,
        query: str,
        match_threshold: float = 0.7,
        match_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve similar documents using pgvector cosine similarity.

        Args:
            org_id: Organization UUID
            query: Search query text
            match_threshold: Minimum similarity threshold (0-1)
            match_count: Maximum number of results

        Returns:
            List of matching documents with similarity scores
        """
        # Generate query embedding
        query_embedding = ai_client.generate_embedding(query)

        # Use pgvector similarity search via RPC
        # This calls the match_documents function we'll create in schema
        result = self.supabase.rpc(
            "match_training_documents",
            {
                "query_embedding": query_embedding,
                "match_org_id": org_id,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        return result.data or []

    def get_brand_voice(self, org_id: str) -> Optional[Dict[str, Any]]:
        """
        Get brand voice for an organization.

        Args:
            org_id: Organization UUID

        Returns:
            Brand voice record or None if not found
        """
        result = self.supabase.table("brand_voices").select("*").eq("org_id", org_id).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None

    def get_training_documents(self, org_id: str) -> List[Dict[str, Any]]:
        """
        Get all training documents for an organization.

        Args:
            org_id: Organization UUID

        Returns:
            List of training documents
        """
        result = self.supabase.table("training_documents").select("*").eq("org_id", org_id).execute()
        return result.data or []

    def build_brand_voice_context(self, org_id: str, query: str) -> str:
        """
        Build a context string from brand voice and similar documents.

        Args:
            org_id: Organization UUID
            query: Current query for retrieving relevant documents

        Returns:
            Combined context string for RAG
        """
        context_parts = []

        # Get brand voice characteristics
        brand_voice = self.get_brand_voice(org_id)
        if brand_voice:
            if brand_voice.get("voice_characteristics"):
                chars = brand_voice["voice_characteristics"]
                context_parts.append(f"Brand Voice: {chars}")

        # Get similar training documents
        similar_docs = self.retrieve_similar_documents(org_id, query)
        if similar_docs:
            docs_text = "\n\nReference Documents:\n"
            for doc in similar_docs[:3]:  # Top 3 most relevant
                docs_text += f"- {doc.get('file_name', 'Unknown')}: {doc.get('content_text', '')[:200]}...\n"
            context_parts.append(docs_text)

        return "\n\n".join(context_parts) if context_parts else ""


# Global manager instance
brand_voice_manager = BrandVoiceManager()
