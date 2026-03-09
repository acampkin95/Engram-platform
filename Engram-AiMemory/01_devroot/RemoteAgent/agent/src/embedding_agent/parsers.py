"""Document parsing and text extraction for various file types."""

import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional

from rich.console import Console

console = Console()


class DocumentParser(ABC):
    """Abstract base class for document parsers."""

    @abstractmethod
    def can_parse(self, file_path: Path) -> bool:
        """Check if this parser can handle the given file."""
        pass

    @abstractmethod
    def parse(self, file_path: Path) -> str:
        """Extract text content from the file."""
        pass


class PlainTextParser(DocumentParser):
    """Parser for plain text files."""

    EXTENSIONS = {".txt", ".md", ".csv", ".yml", ".yaml", ".json", ".jsonc"}

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.EXTENSIONS

    def parse(self, file_path: Path) -> str:
        try:
            return file_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            console.print(f"[yellow]Warning: Could not read {file_path}: {e}[/yellow]")
            return ""


class CodeParser(DocumentParser):
    """Parser for source code files with syntax awareness."""

    EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".css", ".html", ".rtf"}

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.EXTENSIONS

    def parse(self, file_path: Path) -> str:
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
            # Add file metadata as context
            metadata = f"File: {file_path.name}\nLanguage: {self._detect_language(file_path)}\n\n"
            return metadata + content
        except Exception as e:
            console.print(f"[yellow]Warning: Could not read {file_path}: {e}[/yellow]")
            return ""

    def _detect_language(self, file_path: Path) -> str:
        mapping = {
            ".ts": "TypeScript",
            ".tsx": "TypeScript React",
            ".js": "JavaScript",
            ".jsx": "JavaScript React",
            ".py": "Python",
            ".css": "CSS",
            ".html": "HTML",
            ".rtf": "Rich Text Format",
        }
        return mapping.get(file_path.suffix.lower(), "Unknown")


class PDFParser(DocumentParser):
    """Parser for PDF documents."""

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".pdf"

    def parse(self, file_path: Path) -> str:
        try:
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            text_parts = []
            for page_num, page in enumerate(reader.pages, 1):
                text = page.extract_text()
                if text:
                    text_parts.append(f"[Page {page_num}]\n{text}")
            return "\n\n".join(text_parts)
        except ImportError:
            console.print("[yellow]pypdf not installed, skipping PDF[/yellow]")
            return ""
        except Exception as e:
            console.print(f"[yellow]Warning: Could not parse PDF {file_path}: {e}[/yellow]")
            return ""


class DocxParser(DocumentParser):
    """Parser for Word documents."""

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".docx"

    def parse(self, file_path: Path) -> str:
        try:
            from docx import Document

            doc = Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except ImportError:
            console.print("[yellow]python-docx not installed, skipping DOCX[/yellow]")
            return ""
        except Exception as e:
            console.print(f"[yellow]Warning: Could not parse DOCX {file_path}: {e}[/yellow]")
            return ""


class HTMLParser(DocumentParser):
    """Parser for HTML files with tag stripping."""

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in {".html", ".htm"}

    def parse(self, file_path: Path) -> str:
        try:
            from bs4 import BeautifulSoup

            content = file_path.read_text(encoding="utf-8", errors="replace")
            soup = BeautifulSoup(content, "lxml")

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            text = soup.get_text(separator="\n", strip=True)
            # Clean up excessive whitespace
            text = re.sub(r"\n{3,}", "\n\n", text)
            return text
        except ImportError:
            # Fallback to plain text if beautifulsoup not available
            return file_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            console.print(f"[yellow]Warning: Could not parse HTML {file_path}: {e}[/yellow]")
            return ""


class ParserRegistry:
    """Registry of all available document parsers."""

    def __init__(self):
        self.parsers: List[DocumentParser] = [
            PDFParser(),
            DocxParser(),
            HTMLParser(),
            CodeParser(),
            PlainTextParser(),  # Fallback, should be last
        ]

    def get_parser(self, file_path: Path) -> Optional[DocumentParser]:
        """Find the appropriate parser for a file."""
        for parser in self.parsers:
            if parser.can_parse(file_path):
                return parser
        return None

    def parse(self, file_path: Path) -> str:
        """Parse a file using the appropriate parser."""
        parser = self.get_parser(file_path)
        if parser:
            return parser.parse(file_path)
        console.print(f"[yellow]No parser available for {file_path}[/yellow]")
        return ""


# Global parser registry
_registry: Optional[ParserRegistry] = None


def get_parser_registry() -> ParserRegistry:
    """Get the global parser registry."""
    global _registry
    if _registry is None:
        _registry = ParserRegistry()
    return _registry
