from datetime import UTC, datetime
from typing import Any

from memory_system.memory import Memory, TemporalBounds, TemporalResolution

class TemporalExtractor:
    """Extract temporal bounding events from raw memory text."""
    
    def __init__(self, llm_client=None) -> None:
        self.llm = llm_client

    async def extract_timeline_events(self, text: str) -> list[dict[str, Any]]:
        """
        Use an LLM to parse text into chronological events.
        Expected output structure: list of { event: str, start_time: ISO, end_time: ISO, is_ongoing: bool }
        """
        if not self.llm:
            return []
            
        prompt = f"""
        Extract all chronological events from the following text. 
        Format as a strict JSON list of objects with the keys: 
        "event", "start_time" (ISO format), "end_time" (ISO format or null), "is_ongoing" (boolean).
        
        Text: {text}
        """
        
        try:
            response = await self.llm.generate(prompt, format="json")
            import json
            return json.loads(response)
        except Exception:
            return []

    def bind_temporal_bounds(self, memory: Memory, bounds: dict[str, Any]) -> Memory:
        """Attach temporal bounds to a Memory object."""
        start = bounds.get("start_time")
        end = bounds.get("end_time")
        
        try:
            start_dt = datetime.fromisoformat(start) if start else None
            end_dt = datetime.fromisoformat(end) if end else None
        except ValueError:
            start_dt = None
            end_dt = None
            
        tb = TemporalBounds(
            start_time=start_dt,
            end_time=end_dt,
            is_ongoing=bounds.get("is_ongoing", False),
            resolution=TemporalResolution.APPROXIMATE if (start_dt or end_dt) else TemporalResolution.UNKNOWN
        )
        
        memory.temporal_bounds = tb
        memory.is_event = True
        return memory
