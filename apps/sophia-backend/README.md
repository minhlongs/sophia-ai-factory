# Sophia AI Factory Backend

FastAPI backend for AI-powered proposal generation with brand voice RAG.

## Features

- **OpenAI Integration**: GPT-4 text generation + embeddings
- **pgvector RAG**: Similarity search for brand voice matching
- **Proposal Generation**: Full proposal generation with brand voice
- **Supabase**: PostgreSQL database with vector embeddings

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/macbook/mekong-cli/apps/sophia-factory/backend
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```bash
cp ../../.env.local .env
```

Required variables:
- `OPENAI_API_KEY` - OpenAI API key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### 3. Run Server

```bash
# Development
python -m uvicorn backend.main:app --reload --port 8000

# Production
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check

```bash
GET /health
```

### AI Endpoints

```bash
# Generate embedding
POST /ai/embeddings
{
  "text": "Your text here"
}

# Generate text with GPT-4
POST /ai/generate
{
  "prompt": "Your prompt",
  "system_message": "Optional system message",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

### Brand Voice Endpoints

```bash
# Store brand voice
POST /brand-voice/store
{
  "org_id": "uuid",
  "content": "Brand voice content",
  "characteristics": {"tone": "professional"}
}

# Get brand voice
GET /brand-voice/{org_id}

# Search similar documents (RAG)
POST /brand-voice/search
{
  "org_id": "uuid",
  "query": "search query",
  "match_threshold": 0.7,
  "match_count": 5
}
```

### Training Documents

```bash
# Store training document
POST /training-documents/store
{
  "org_id": "uuid",
  "file_name": "document.pdf",
  "file_url": "https://...",
  "content_text": "Extracted text content",
  "file_type": "application/pdf"
}

# Get training documents
GET /training-documents/{org_id}
```

### Proposal Generation

```bash
# Generate full proposal
POST /proposals/generate
{
  "org_id": "uuid",
  "title": "Proposal Title",
  "client_name": "Client Name",
  "project_brief": "Project description",
  "requirements": ["req1", "req2"],
  "budget_range": "$10k-20k",
  "timeline_preference": "4-6 weeks"
}

# Generate outline
POST /proposals/outline
{
  "project_brief": "...",
  "requirements": ["req1", "req2"]
}

# Refine section
POST /proposals/refine
{
  "org_id": "uuid",
  "section_type": "executive_summary",
  "existing_content": "...",
  "feedback": "Make it more concise"
}
```

## Project Structure

```
backend/
├── __init__.py              # Package exports
├── main.py                  # FastAPI app + endpoints
├── ai_client.py             # OpenAI client (embeddings + GPT-4)
├── brand_voice.py           # pgvector RAG manager
├── proposal_generator.py    # Proposal generation logic
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  FastAPI App (main.py)                              │
│  - REST endpoints                                    │
│  - Request/Response models                           │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
┌────────▼────────┐  ┌────────▼────────┐
│  AIClient       │  │  BrandVoiceMgr  │
│  - OpenAI API   │  │  - Supabase     │
│  - Embeddings   │  │  - pgvector RAG │
│  - GPT-4        │  │  - Similarity   │
└─────────────────┘  └─────────────────┘
         │                    │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │ ProposalGenerator  │
         │ - RAG context      │
         │ - Section gen      │
         └────────────────────┘
```

## Database Schema

The backend uses Supabase PostgreSQL with pgvector:

- `brand_voices` - Organization brand voice embeddings
- `training_documents` - Training docs with embeddings
- `proposals` - Generated proposals
- `organizations` - Tenant organizations
- `users` - User accounts

See `../database/schema.sql` for full schema.

## Testing

```bash
# Run tests
pytest

# Test specific endpoint
curl -X GET http://localhost:8000/health
```

## License

MIT
