# weaviate_memory/context.py
"""
Context building for LLM integration with token management.
"""

import weaviate
from datetime import datetime
from typing import Optional
from .retrieval import MemoryRetrieval


class ContextBuilder:
    """Build LLM context from memories with token management."""
    
    def __init__(
        self,
        retrieval: MemoryRetrieval,
        max_tokens: int = 4000
    ):
        """
        Initialize context builder.
        
        Args:
            retrieval: MemoryRetrieval instance
            max_tokens: Maximum tokens for context
        """
        self.retrieval = retrieval
        self.max_tokens = max_tokens
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count (~4 chars per token)."""
        return len(text) // 4
    
    def compress_memory(self, memory: dict, memory_type: str) -> str:
        """Create compressed representation of memory."""
        if memory_type == "episodic":
            event_type = memory.get('eventType', 'event')
            content = memory.get('content', '')[:150]
            return f"[{event_type}] {content}"
        
        elif memory_type == "semantic":
            fact = memory.get('fact', '')[:150]
            return f"[FACT] {fact}"
        
        elif memory_type == "procedural":
            name = memory.get('workflowName', '')
            steps = memory.get('steps', [])[:3]
            return f"[WORKFLOW: {name}] Steps: {' → '.join(steps)}"
        
        return str(memory)[:150]
    
    def build_context_for_query(
        self,
        query: str,
        include_episodic: bool = True,
        include_semantic: bool = True,
        include_procedural: bool = False,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> str:
        """
        Build memory context string for LLM prompt.
        
        Args:
            query: The search/context query
            include_episodic: Include episodic memories
            include_semantic: Include semantic memories
            include_procedural: Include procedural memories
            session_id: Optional session for context
            user_id: Optional user filter
        
        Returns:
            Formatted context string
        """
        context_parts = []
        token_budget = self.max_tokens
        
        # Determine which memory types to include
        memory_types = []
        if include_episodic:
            memory_types.append("episodic")
        if include_semantic:
            memory_types.append("semantic")
        if include_procedural:
            memory_types.append("procedural")
        
        # Retrieve relevant memories
        memories = self.retrieval.retrieve_relevant_memories(
            query=query,
            memory_types=memory_types,
            limit=20
        )
        
        # Build context with token budget
        context_parts.append("## Relevant Memory Context\n")
        
        for mem in memories:
            compressed = self.compress_memory(mem["properties"], mem["type"])
            tokens = self.estimate_tokens(compressed)
            
            if token_budget - tokens < 0:
                break
            
            score_info = f"(relevance: {mem['scores']['composite']:.2f})"
            context_parts.append(f"- {compressed} {score_info}")
            token_budget -= tokens
        
        # Add session context if provided
        if session_id and token_budget > 500:
            context_parts.append("\n## Recent Session Context\n")
            session_memories = self.retrieval.retrieve_session_context(
                session_id, limit=5
            )
            
            for mem in session_memories:
                compressed = self.compress_memory(mem, "episodic")
                tokens = self.estimate_tokens(compressed)
                
                if token_budget - tokens < 0:
                    break
                
                context_parts.append(f"- {compressed}")
                token_budget -= tokens
        
        # Add user preferences if available
        if user_id and token_budget > 300:
            preferences = self.retrieval.retrieve_user_preferences(user_id)[:3]
            
            if preferences:
                context_parts.append("\n## User Preferences\n")
                for pref in preferences:
                    fact = pref.get("fact", "")[:100]
                    tokens = self.estimate_tokens(fact)
                    
                    if token_budget - tokens < 0:
                        break
                    
                    context_parts.append(f"- {fact}")
                    token_budget -= tokens
        
        return "\n".join(context_parts)
    
    def build_rag_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> dict:
        """
        Build structured context for RAG pipeline.
        
        Returns:
            Dict with preferences, facts, episodes, procedures, and formatted context
        """
        # Get user preferences if available
        preferences = []
        if user_id:
            preferences = self.retrieval.retrieve_user_preferences(user_id)[:5]
        
        # Get relevant facts
        facts = self.retrieval.semantic.query.near_text(
            query=query, limit=5
        ).objects
        
        # Get relevant episodes
        episodes = self.retrieval.episodic.query.hybrid(
            query=query, alpha=0.7, limit=5
        ).objects
        
        # Get applicable procedures
        procedures = self.retrieval.retrieve_applicable_procedures(query, limit=2)
        
        return {
            "preferences": [p for p in preferences],
            "facts": [f.properties for f in facts],
            "episodes": [e.properties for e in episodes],
            "procedures": procedures,
            "formatted_context": self.build_context_for_query(
                query,
                include_procedural=bool(procedures),
                user_id=user_id,
                session_id=session_id
            )
        }


class ConversationMemoryManager:
    """
    Manage conversation history with automatic summarization
    when history exceeds token budget.
    """
    
    def __init__(
        self,
        max_context_tokens: int = 4000,
        llm_client=None
    ):
        """
        Initialize conversation manager.
        
        Args:
            max_context_tokens: Maximum tokens for context
            llm_client: Optional LLM for summarization
        """
        self.max_tokens = max_context_tokens
        self.llm = llm_client
        self.conversation_history = []
        self.summaries = []
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count."""
        return len(text) // 4
    
    def get_total_tokens(self) -> int:
        """Calculate total tokens in current context."""
        history_tokens = sum(
            self.estimate_tokens(msg.get("content", ""))
            for msg in self.conversation_history
        )
        summary_tokens = sum(
            self.estimate_tokens(s) for s in self.summaries
        )
        return history_tokens + summary_tokens
    
    def should_summarize(self) -> bool:
        """Check if conversation should be summarized."""
        return self.get_total_tokens() > self.max_tokens * 0.8
    
    def add_message(
        self,
        role: str,
        content: str,
        metadata: Optional[dict] = None
    ):
        """Add message and manage context window."""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.conversation_history.append(message)
        
        if self.should_summarize() and len(self.conversation_history) > 10:
            self.compact_history()
    
    def compact_history(self):
        """Move older messages into summary."""
        keep_count = 5
        to_summarize = self.conversation_history[:-keep_count]
        
        if to_summarize:
            summary = self._create_summary(to_summarize)
            self.summaries.append(summary)
            self.conversation_history = self.conversation_history[-keep_count:]
    
    def _create_summary(self, messages: list[dict]) -> str:
        """Create summary of messages."""
        if self.llm:
            messages_text = "\n".join([
                f"{m['role']}: {m['content'][:200]}"
                for m in messages
            ])
            # Call LLM for summary
            # return self.llm(f"Summarize this conversation:\n{messages_text}")
        
        # Simple extraction without LLM
        topics = set()
        for m in messages:
            words = m.get("content", "").split()[:10]
            topics.update(w for w in words if len(w) > 4)
        
        return f"[Summary of {len(messages)} messages. Topics: {', '.join(list(topics)[:5])}]"
    
    def get_context_for_llm(self) -> str:
        """Get formatted context for LLM."""
        context = ""
        
        if self.summaries:
            context += "## Previous Conversation Summary\n"
            for i, summary in enumerate(self.summaries[-3:]):
                context += f"{summary}\n\n"
        
        context += "## Recent Messages\n"
        for msg in self.conversation_history:
            role = msg["role"].upper()
            content = msg["content"][:500]
            context += f"{role}: {content}\n"
        
        return context
    
    def clear(self):
        """Clear all conversation history."""
        self.conversation_history = []
        self.summaries = []
    
    def get_last_n_messages(self, n: int = 5) -> list[dict]:
        """Get the last N messages."""
        return self.conversation_history[-n:]
