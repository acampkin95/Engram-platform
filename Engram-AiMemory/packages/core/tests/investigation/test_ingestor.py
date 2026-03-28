"""Unit tests for document ingestors."""
from __future__ import annotations

import csv

import pytest

from memory_system.investigation.ingestor import (
    EmailIngestor,
    IngestedDocument,
    PDFIngestor,
    SpreadsheetIngestor,
    ingest_file,
)


class TestSpreadsheetIngestor:
    def test_csv_ingest_basic(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        with open(csv_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "date", "amount"])
            writer.writeheader()
            for i in range(5):
                writer.writerow({"name": f"Person {i}", "date": "2024-01-01", "amount": str(i * 100)})

        ingestor = SpreadsheetIngestor()
        docs = ingestor.ingest_csv(str(csv_file), "test_matter")

        assert len(docs) >= 1
        assert docs[0].source_type == "CSV"
        assert docs[0].matter_id == "test_matter"
        assert "Person 0" in docs[0].content

    def test_csv_chunking(self, tmp_path):
        csv_file = tmp_path / "large.csv"
        with open(csv_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["id", "value"])
            writer.writeheader()
            for i in range(250):
                writer.writerow({"id": str(i), "value": f"val_{i}"})

        ingestor = SpreadsheetIngestor()
        docs = ingestor.ingest_csv(str(csv_file), "test_matter")

        # 250 rows / 100 per chunk = 3 chunks
        assert len(docs) == 3

    def test_csv_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            SpreadsheetIngestor().ingest_csv("/nonexistent/file.csv", "test_matter")

    def test_ingest_file_factory_csv(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        with open(csv_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["x"])
            writer.writeheader()
            writer.writerow({"x": "1"})

        docs = ingest_file(str(csv_file), "test_matter")
        assert len(docs) >= 1

    def test_ingest_file_unsupported_extension(self):
        with pytest.raises(ValueError, match="Unsupported"):
            ingest_file("/some/file.xyz", "test_matter")


class TestEmailIngestor:
    def test_eml_ingest(self, tmp_path):
        eml_content = b"""From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 01 Jan 2024 12:00:00 +0000
Message-ID: <test@example.com>
Content-Type: text/plain

This is the email body content.
"""
        eml_file = tmp_path / "test.eml"
        eml_file.write_bytes(eml_content)

        ingestor = EmailIngestor()
        doc = ingestor.ingest_eml(str(eml_file), "test_matter")

        assert doc is not None
        assert doc.source_type == "EMAIL"
        assert "Test Email" in doc.content
        assert "sender@example.com" in doc.content
        assert "email body content" in doc.content

    def test_eml_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            EmailIngestor().ingest_eml("/nonexistent/file.eml", "test_matter")


class TestPDFIngestor:
    def test_pdf_file_not_found(self):
        # PDFIngestor requires PyMuPDF (fitz). If fitz is not installed,
        # ImportError is raised before FileNotFoundError.
        with pytest.raises((FileNotFoundError, ImportError)):
            PDFIngestor().ingest("/nonexistent/file.pdf", "test_matter")


class TestIngestedDocument:
    def test_ingested_document_creation(self):
        doc = IngestedDocument(
            content="Test content",
            source_type="CSV",
            source_url="/path/to/file.csv",
            matter_id="CASE-001",
        )
        assert doc.content == "Test content"
        assert doc.metadata == {}
        assert doc.page_number is None
        assert doc.message_id is None
