"""SOP Storage - Filesystem with versioning"""

from pathlib import Path

from ..core.exceptions import SOPNotFoundError
from ..core.models import SOP
from ..sops.parser import SOPParser


class SOPStorage:
    """Store and retrieve SOPs from filesystem"""

    def __init__(self, sops_path: str = None, enable_rag: bool = True):
        self.sops_path = Path(sops_path or "./sops/procedures")
        self.parser = SOPParser()
        self.sops_path.mkdir(parents=True, exist_ok=True)

        # RAG integration (optional)
        self.enable_rag = enable_rag
        self._rag = None
        if enable_rag:
            try:
                from ..rag.retriever import RAGEngine
                self._rag = RAGEngine()
            except ImportError:
                self._rag = None

    def _index_sop(self, sop: SOP):
        """Index SOP in RAG if enabled"""
        if self.enable_rag and self._rag:
            try:
                self._rag.index_sop(sop)
            except Exception:
                pass  # Silent fail for RAG indexing

    def save(self, sop: SOP) -> Path:
        """Save SOP to filesystem"""
        # Create version directory
        version_dir = self.sops_path / sop.name / sop.version
        version_dir.mkdir(parents=True, exist_ok=True)

        # Save SOP
        sop_file = version_dir / "sop.yaml"
        content = self.parser.to_yaml(sop)
        sop_file.write_text(content)

        # Update latest symlink with relative path
        latest_link = self.sops_path / sop.name / "latest"
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        # Use simple relative path: just the version folder name
        latest_link.symlink_to("1.0.0")

        # Index in RAG
        self._index_sop(sop)

        return sop_file

    def load(self, name: str, version: str = None) -> SOP:
        """Load SOP from filesystem"""
        sop_dir = self.sops_path / name

        if not sop_dir.exists():
            raise SOPNotFoundError(name)

        if version:
            version_dir = sop_dir / version
        else:
            # Use latest
            latest_link = sop_dir / "latest"
            if not latest_link.exists():
                raise SOPNotFoundError(name)
            version_dir = latest_link.resolve()

        sop_file = version_dir / "sop.yaml"
        if not sop_file.exists():
            raise SOPNotFoundError(name)

        return self.parser.parse_file(sop_file)

    def list_sops(self) -> list[dict]:
        """List all available SOPs"""
        sops = []

        for sop_dir in self.sops_path.iterdir():
            if not sop_dir.is_dir() or sop_dir.name == "templates":
                continue

            latest_link = sop_dir / "latest"
            if not latest_link.exists():
                continue

            try:
                sop = self.load(sop_dir.name)
                sops.append(
                    {
                        "name": sop.name,
                        "version": sop.version,
                        "description": sop.description,
                        "steps_count": len(sop.steps),
                    }
                )
            except Exception:
                continue

        return sorted(sops, key=lambda x: x["name"])

    def delete(self, name: str, version: str = None) -> bool:
        """Delete SOP"""
        sop_dir = self.sops_path / name

        if not sop_dir.exists():
            return False

        if version:
            version_dir = sop_dir / version
            if version_dir.exists():
                import shutil

                shutil.rmtree(version_dir)
        else:
            import shutil

            shutil.rmtree(sop_dir)

        return True
