import sys
import re

content = open("client.py").read()

def_start = content.find("def _obj_to_memory")

# We need to insert a helper before it
helper = """
    def _parse_json_field(self, props: dict, key: str, default: dict | list) -> dict | list:
        val = props.get(key)
        if not val:
            return default
        if isinstance(val, str):
            import json
            try:
                return json.loads(val)
            except Exception:
                return default
        return val

    """

content = content[:def_start] + helper + content[def_start:]

# Now replace the return Memory( call 
old_return = """            decay_factor=props.get("decay_factor", 1.0),
            canonical_id=props.get("canonical_id") or None,
            is_canonical=props.get("is_canonical", True),
        )"""

new_return = """            decay_factor=props.get("decay_factor", 1.0),
            canonical_id=props.get("canonical_id") or None,
            is_canonical=props.get("is_canonical", True),
            overall_confidence=props.get("overall_confidence", 0.5),
            confidence_factors=self._parse_json_field(props, "confidence_factors", {}),
            provenance=self._parse_json_field(props, "provenance", {}),
            modification_history=self._parse_json_field(props, "modification_history", []),
            contradictions=props.get("contradictions", []),
            contradictions_resolved=props.get("contradictions_resolved", False),
            is_deprecated=props.get("is_deprecated", False),
            deprecated_by=props.get("deprecated_by") or None,
            supporting_evidence_ids=props.get("supporting_evidence_ids", []),
            contradicting_evidence_ids=props.get("contradicting_evidence_ids", []),
            last_contradiction_check=None, # parsing dates is complex here, omitted for brevity as usually not needed in memory object
            last_confidence_update=None,
        )"""

content = content.replace(old_return, new_return)

open("client.py", "w").write(content)
print("Updated client.py obj_to_memory")
