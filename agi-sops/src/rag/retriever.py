"""RAG Engine - Retrieval Augmented Generation for SOPs"""

import os

from ..core.models import SOP


class RAGEngine:
    """RAG engine for SOP retrieval"""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.getenv("LANCEDB_PATH", "./data/lancedb")
        self._db = None
        self._embeddings = None

    def _get_db(self):
        """Lazy load LanceDB"""
        if self._db is None:
            try:
                import lancedb

                self._db = lancedb.connect(self.db_path)
            except ImportError:
                raise ImportError("lancedb package not installed")
        return self._db

    def _get_embeddings(self):
        """Lazy load embeddings"""
        if self._embeddings is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._embeddings = SentenceTransformer("all-MiniLM-L6-v2")
            except ImportError:
                raise ImportError("sentence-transformers package not installed")
        return self._embeddings

    def index_sop(self, sop: SOP):
        """Index SOP for retrieval"""
        db = self._get_db()
        embeddings = self._get_embeddings()

        # Create table if not exists
        table_name = f"sops_{sop.name.replace('-', '_')}"

        # Generate embeddings for SOP content
        sop_content = f"{sop.name} {sop.description} "
        sop_content += " ".join([s.command for s in sop.steps])

        embedding = embeddings.encode(sop_content)

        # Insert into table
        try:
            table = db.open_table(table_name)
        except Exception:
            # Create table
            import pyarrow as pa

            schema = pa.schema(
                [
                    pa.field("id", pa.string()),
                    pa.field("name", pa.string()),
                    pa.field("content", pa.string()),
                    pa.field("vector", pa.list_(pa.float32(), 384)),
                ]
            )
            table = db.create_table(table_name, schema=schema)

        table.add(
            [
                {
                    "id": f"{sop.name}_{sop.version}",
                    "name": sop.name,
                    "content": sop_content,
                    "vector": embedding.tolist(),
                }
            ]
        )

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """Search SOPs by query"""
        db = self._get_db()
        embeddings = self._get_embeddings()

        # Generate query embedding
        query_embedding = embeddings.encode(query)

        results = []
        # list_tables() returns object with .tables attribute
        tables_response = db.list_tables()
        table_names = tables_response.tables if hasattr(tables_response, 'tables') else tables_response

        for table_name in table_names:
            if not table_name.startswith("sops_"):
                continue

            try:
                table = db.open_table(table_name)
                # Search by vector similarity
                result_table = table.search(query_embedding.tolist()).limit(limit).to_list()
                results.extend(result_table)
            except Exception:
                continue

        return sorted(results, key=lambda x: x.get("_distance", 0))[:limit]

    def delete_index(self, sop_name: str):
        """Delete SOP index"""
        db = self._get_db()
        table_name = f"sops_{sop_name.replace('-', '_')}"

        try:
            db.drop_table(table_name)
        except Exception:
            pass
