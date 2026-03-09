"""Text chunking with overlap for optimal embedding retrieval."""

import re
from dataclasses import dataclass
from typing import List, Optional

import tiktoken


@dataclass
class Chunk:
    """A chunk of text with metadata."""

    text: str
    start_char: int
    end_char: int
    chunk_index: int
    total_chunks: int
    token_count: int


class TextChunker:
    """Intelligent text chunking with token counting and overlap."""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base"
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._encoder: Optional[tiktoken.Encoding] = None
        self._encoding_name = encoding_name

    @property
    def encoder(self) -> tiktoken.Encoding:
        """Lazy load the tokenizer."""
        if self._encoder is None:
            self._encoder = tiktoken.get_encoding(self._encoding_name)
        return self._encoder

    def count_tokens(self, text: str) -> int:
        """Count tokens in a text string."""
        return len(self.encoder.encode(text))

    def chunk_text(self, text: str) -> List[Chunk]:
        """Split text into overlapping chunks based on token count."""
        if not text.strip():
            return []

        # Split into sentences for better chunk boundaries
        sentences = self._split_into_sentences(text)
        chunks: List[Chunk] = []

        current_chunk_sentences: List[str] = []
        current_tokens = 0
        chunk_start_char = 0
        char_position = 0

        for sentence in sentences:
            sentence_tokens = self.count_tokens(sentence)

            # If single sentence exceeds chunk size, split it further
            if sentence_tokens > self.chunk_size:
                # Finalize current chunk if any
                if current_chunk_sentences:
                    chunk_text = " ".join(current_chunk_sentences)
                    chunks.append(Chunk(
                        text=chunk_text,
                        start_char=chunk_start_char,
                        end_char=char_position,
                        chunk_index=len(chunks),
                        total_chunks=0,  # Will be set later
                        token_count=current_tokens
                    ))
                    current_chunk_sentences = []
                    current_tokens = 0

                # Split long sentence by words
                word_chunks = self._chunk_by_words(sentence, char_position)
                chunks.extend(word_chunks)
                char_position += len(sentence) + 1
                chunk_start_char = char_position
                continue

            # Check if adding this sentence exceeds the limit
            if current_tokens + sentence_tokens > self.chunk_size:
                # Finalize current chunk
                if current_chunk_sentences:
                    chunk_text = " ".join(current_chunk_sentences)
                    chunks.append(Chunk(
                        text=chunk_text,
                        start_char=chunk_start_char,
                        end_char=char_position,
                        chunk_index=len(chunks),
                        total_chunks=0,
                        token_count=current_tokens
                    ))

                    # Keep overlap sentences
                    overlap_sentences = self._get_overlap_sentences(
                        current_chunk_sentences,
                        self.chunk_overlap
                    )
                    current_chunk_sentences = overlap_sentences
                    current_tokens = sum(
                        self.count_tokens(s) for s in overlap_sentences
                    )
                    chunk_start_char = char_position - sum(
                        len(s) + 1 for s in overlap_sentences
                    )

            current_chunk_sentences.append(sentence)
            current_tokens += sentence_tokens
            char_position += len(sentence) + 1

        # Finalize last chunk
        if current_chunk_sentences:
            chunk_text = " ".join(current_chunk_sentences)
            chunks.append(Chunk(
                text=chunk_text,
                start_char=chunk_start_char,
                end_char=char_position,
                chunk_index=len(chunks),
                total_chunks=0,
                token_count=current_tokens
            ))

        # Update total_chunks for all chunks
        total = len(chunks)
        for i, chunk in enumerate(chunks):
            chunks[i] = Chunk(
                text=chunk.text,
                start_char=chunk.start_char,
                end_char=chunk.end_char,
                chunk_index=i,
                total_chunks=total,
                token_count=chunk.token_count
            )

        return chunks

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex."""
        # Handle common sentence boundaries
        sentence_pattern = r"(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\S)"
        sentences = re.split(sentence_pattern, text)
        return [s.strip() for s in sentences if s.strip()]

    def _get_overlap_sentences(
        self,
        sentences: List[str],
        target_overlap_tokens: int
    ) -> List[str]:
        """Get sentences from the end that fit within overlap token budget."""
        overlap_sentences = []
        token_count = 0

        for sentence in reversed(sentences):
            sentence_tokens = self.count_tokens(sentence)
            if token_count + sentence_tokens > target_overlap_tokens:
                break
            overlap_sentences.insert(0, sentence)
            token_count += sentence_tokens

        return overlap_sentences

    def _chunk_by_words(self, text: str, start_char: int) -> List[Chunk]:
        """Chunk a long text by words when it exceeds the chunk size."""
        words = text.split()
        chunks = []

        current_words: List[str] = []
        current_tokens = 0
        word_start_char = start_char

        for word in words:
            word_tokens = self.count_tokens(word)

            if current_tokens + word_tokens > self.chunk_size and current_words:
                chunk_text = " ".join(current_words)
                chunks.append(Chunk(
                    text=chunk_text,
                    start_char=word_start_char,
                    end_char=word_start_char + len(chunk_text),
                    chunk_index=len(chunks),
                    total_chunks=0,
                    token_count=current_tokens
                ))

                # Overlap: keep last few words
                overlap_words = current_words[-3:] if len(current_words) > 3 else []
                current_words = overlap_words
                current_tokens = sum(self.count_tokens(w) for w in overlap_words)
                word_start_char += len(chunk_text) + 1 - sum(len(w) + 1 for w in overlap_words)

            current_words.append(word)
            current_tokens += word_tokens

        if current_words:
            chunk_text = " ".join(current_words)
            chunks.append(Chunk(
                text=chunk_text,
                start_char=word_start_char,
                end_char=word_start_char + len(chunk_text),
                chunk_index=len(chunks),
                total_chunks=0,
                token_count=current_tokens
            ))

        return chunks
