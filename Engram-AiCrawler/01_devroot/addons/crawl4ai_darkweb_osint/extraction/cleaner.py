"""
Content cleaning for dark web extraction.

Handles:
- HTML to text conversion
- Script/style removal
- Whitespace normalization
- Metadata extraction
"""

import logging
import re
from typing import Optional, Any
from html.parser import HTMLParser
from html import unescape

logger = logging.getLogger(__name__)


# Tags to completely remove including content
REMOVE_TAGS = {
    "script",
    "style",
    "noscript",
    "iframe",
    "object",
    "embed",
    "applet",
    "form",
    "input",
    "button",
    "select",
    "textarea",
}

# Tags that are just containers (keep content, remove tag)
CONTAINER_TAGS = {
    "div",
    "span",
    "section",
    "article",
    "aside",
    "header",
    "footer",
    "nav",
    "main",
    "figure",
    "figcaption",
    "picture",
}

# Block-level tags (add newline)
BLOCK_TAGS = {
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "table",
    "tr",
    "th",
    "td",
    "blockquote",
    "pre",
    "address",
}


class ContentCleaner(HTMLParser):
    """
    HTML parser that extracts clean text content.
    """

    def __init__(self):
        super().__init__()
        self.result: list[str] = []
        self.skip_content = False
        self.skip_tag = None
        self.tag_stack: list[str] = []
        self.links: list[dict[str, str]] = []
        self.current_link: Optional[str] = None
        self.current_link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple]):
        tag_lower = tag.lower()
        attrs_dict = dict(attrs)

        # Track if we should skip this tag's content
        if tag_lower in REMOVE_TAGS:
            self.skip_content = True
            self.skip_tag = tag_lower
            return

        if self.skip_content:
            return

        self.tag_stack.append(tag_lower)

        # Handle links
        if tag_lower == "a":
            self.current_link = attrs_dict.get("href", "")
            self.current_link_text = []

        # Add newlines for block tags
        if tag_lower in BLOCK_TAGS:
            if self.result and not self.result[-1].endswith("\n"):
                self.result.append("\n")

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()

        # Stop skipping if this closes the skip tag
        if self.skip_content and tag_lower == self.skip_tag:
            self.skip_content = False
            self.skip_tag = None
            return

        if self.skip_content:
            return

        # Pop from tag stack
        if self.tag_stack and self.tag_stack[-1] == tag_lower:
            self.tag_stack.pop()

        # Handle link end
        if tag_lower == "a" and self.current_link:
            link_text = " ".join(self.current_link_text).strip()
            if link_text and self.current_link:
                self.links.append(
                    {
                        "text": link_text,
                        "href": self.current_link,
                    }
                )
            self.current_link = None
            self.current_link_text = []

        # Add newline for block tags
        if tag_lower in BLOCK_TAGS:
            if self.result and not self.result[-1].endswith("\n"):
                self.result.append("\n")

    def handle_data(self, data: str):
        if self.skip_content:
            return

        # Track link text
        if self.current_link is not None:
            self.current_link_text.append(data.strip())

        # Add text content
        text = data.strip()
        if text:
            self.result.append(text)

    def get_text(self) -> str:
        """Get the cleaned text."""
        return "".join(self.result)

    def get_links(self) -> list[dict[str, str]]:
        """Get extracted links."""
        return self.links


def clean_html(html: str) -> str:
    """
    Clean HTML content to plain text.

    Args:
        html: Raw HTML string

    Returns:
        Cleaned text string
    """
    if not html:
        return ""

    try:
        cleaner = ContentCleaner()
        cleaner.feed(html)
        text = cleaner.get_text()

        # Normalize whitespace
        text = normalize_whitespace(text)

        return text

    except Exception as e:
        logger.warning(f"HTML cleaning failed: {e}")
        # Fallback: strip tags with regex
        text = re.sub(r"<[^>]+>", "", html)
        return normalize_whitespace(unescape(text))


def clean_content(content: str) -> str:
    """
    Clean content string (HTML or plain text).

    Detects if content is HTML and cleans accordingly.

    Args:
        content: Content string (HTML or plain text)

    Returns:
        Cleaned text string
    """
    if not content:
        return ""

    # Detect if content is HTML
    if "<" in content and ">" in content:
        return clean_html(content)

    # Already plain text, just normalize
    return normalize_whitespace(content)


def normalize_whitespace(text: str) -> str:
    """
    Normalize whitespace in text.

    - Collapse multiple spaces to single space
    - Collapse multiple newlines to double newline
    - Strip leading/trailing whitespace

    Args:
        text: Input text

    Returns:
        Normalized text
    """
    if not text:
        return ""

    # Replace multiple spaces with single space (within lines)
    text = re.sub(r"[ \t]+", " ", text)

    # Replace 3+ newlines with 2 newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip whitespace at line starts/ends
    lines = text.split("\n")
    lines = [line.strip() for line in lines]
    text = "\n".join(lines)

    # Remove leading/trailing whitespace
    text = text.strip()

    return text


def extract_metadata(html: str) -> dict[str, Any]:
    """
    Extract metadata from HTML.

    Extracts:
    - Title
    - Meta description
    - Meta keywords
    - Open Graph tags
    - Twitter Card tags
    - Canonical URL

    Args:
        html: HTML content

    Returns:
        Dictionary of extracted metadata
    """
    metadata = {}

    if not html:
        return metadata

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find("title")
        if title_tag:
            metadata["title"] = title_tag.get_text(strip=True)

        # Standard meta tags
        for meta in soup.find_all("meta"):
            name = meta.get("name", "").lower()
            prop = meta.get("property", "").lower()
            content = meta.get("content", "")

            if name == "description":
                metadata["description"] = content
            elif name == "keywords":
                metadata["keywords"] = content
            elif name == "author":
                metadata["author"] = content
            elif prop == "og:title":
                metadata["og_title"] = content
            elif prop == "og:description":
                metadata["og_description"] = content
            elif prop == "og:image":
                metadata["og_image"] = content
            elif prop == "og:url":
                metadata["og_url"] = content
            elif name == "twitter:card":
                metadata["twitter_card"] = content
            elif name == "twitter:title":
                metadata["twitter_title"] = content
            elif name == "twitter:description":
                metadata["twitter_description"] = content

        # Canonical URL
        canonical = soup.find("link", rel="canonical")
        if canonical:
            metadata["canonical_url"] = canonical.get("href", "")

        # Charset
        charset_meta = soup.find("meta", charset=True)
        if charset_meta:
            metadata["charset"] = charset_meta.get("charset", "")

    except ImportError:
        # Fallback without BeautifulSoup
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if title_match:
            metadata["title"] = clean_content(title_match.group(1))

        desc_match = re.search(
            r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE,
        )
        if desc_match:
            metadata["description"] = desc_match.group(1)

    except Exception as e:
        logger.warning(f"Metadata extraction failed: {e}")

    return metadata


def truncate_content(content: str, max_length: int = 2000) -> str:
    """
    Truncate content to maximum length.

    Preserves word boundaries.

    Args:
        content: Content to truncate
        max_length: Maximum length in characters

    Returns:
        Truncated content with ellipsis if needed
    """
    if not content or len(content) <= max_length:
        return content

    # Find last space before max_length
    truncated = content[:max_length]
    last_space = truncated.rfind(" ")

    if last_space > max_length * 0.8:  # Keep 80% of content
        truncated = truncated[:last_space]

    return truncated + "..."


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Content cleaning utilities")
    parser.add_argument("--clean", help="Clean HTML file or string")
    parser.add_argument("--metadata", help="Extract metadata from HTML file")
    parser.add_argument("--truncate", type=int, help="Truncate to max length")

    args = parser.parse_args()

    if args.clean:
        # Check if it's a file
        try:
            with open(args.clean) as f:
                html = f.read()
        except FileNotFoundError:
            html = args.clean

        text = clean_content(html)

        if args.truncate:
            text = truncate_content(text, args.truncate)

        print(text)

    elif args.metadata:
        try:
            with open(args.metadata) as f:
                html = f.read()

            import json

            print(json.dumps(extract_metadata(html), indent=2))
        except FileNotFoundError:
            print(f"File not found: {args.metadata}")

    else:
        parser.print_help()
