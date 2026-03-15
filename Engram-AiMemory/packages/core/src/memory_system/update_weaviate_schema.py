
content = open("client.py").read()

# Update _ensure_schemas
old_props = """            Property(name="updated_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="expires_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="related_memory_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="parent_memory_id", data_type=DataType.TEXT),
            Property(name="embedding_model", data_type=DataType.TEXT),
            Property(name="embedding_dimension", data_type=DataType.INT),
            Property(name="embedding_updated_at", data_type=DataType.DATE),
            Property(name="access_count", data_type=DataType.INT, index_filterable=True),
            Property(name="last_accessed_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="decay_factor", data_type=DataType.NUMBER),
            Property(name="canonical_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="is_canonical", data_type=DataType.BOOL, index_filterable=True),
        ]"""

new_props = """            Property(name="updated_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="expires_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="related_memory_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="parent_memory_id", data_type=DataType.TEXT),
            Property(name="embedding_model", data_type=DataType.TEXT),
            Property(name="embedding_dimension", data_type=DataType.INT),
            Property(name="embedding_updated_at", data_type=DataType.DATE),
            Property(name="access_count", data_type=DataType.INT, index_filterable=True),
            Property(name="last_accessed_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="decay_factor", data_type=DataType.NUMBER),
            Property(name="canonical_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="is_canonical", data_type=DataType.BOOL, index_filterable=True),
            # Advanced Integrity & Confidence Features
            Property(name="overall_confidence", data_type=DataType.NUMBER, index_filterable=True),
            Property(name="confidence_factors", data_type=DataType.TEXT), # JSON stringified
            Property(name="provenance", data_type=DataType.TEXT), # JSON stringified
            Property(name="modification_history", data_type=DataType.TEXT), # JSON stringified
            Property(name="contradictions", data_type=DataType.TEXT_ARRAY, index_filterable=True),
            Property(name="contradictions_resolved", data_type=DataType.BOOL, index_filterable=True),
            Property(name="is_deprecated", data_type=DataType.BOOL, index_filterable=True),
            Property(name="deprecated_by", data_type=DataType.TEXT, index_filterable=True),
            Property(name="supporting_evidence_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="contradicting_evidence_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="last_contradiction_check", data_type=DataType.DATE, index_filterable=True),
            Property(name="last_confidence_update", data_type=DataType.DATE, index_filterable=True),
        ]"""

content = content.replace(old_props, new_props)

# We need to update _memory_to_properties
import_json = "import json\n"
if "import json" not in content:
    content = import_json + content

old_to_props = """            "decay_factor": memory.decay_factor,
            "canonical_id": memory.canonical_id or "",
            "is_canonical": memory.is_canonical,
        }"""

new_to_props = """            "decay_factor": memory.decay_factor,
            "canonical_id": memory.canonical_id or "",
            "is_canonical": memory.is_canonical,
            "overall_confidence": memory.overall_confidence,
            "confidence_factors": json.dumps(memory.confidence_factors.dict() if hasattr(memory.confidence_factors, 'dict') else memory.confidence_factors),
            "provenance": json.dumps(memory.provenance.dict() if hasattr(memory.provenance, 'dict') else memory.provenance),
            "modification_history": json.dumps([m.dict() if hasattr(m, 'dict') else m for m in memory.modification_history]),
            "contradictions": memory.contradictions,
            "contradictions_resolved": memory.contradictions_resolved,
            "is_deprecated": memory.is_deprecated,
            "deprecated_by": memory.deprecated_by or "",
            "supporting_evidence_ids": memory.supporting_evidence_ids,
            "contradicting_evidence_ids": memory.contradicting_evidence_ids,
            "last_contradiction_check": memory.last_contradiction_check.isoformat() if memory.last_contradiction_check else None,
            "last_confidence_update": memory.last_confidence_update.isoformat() if memory.last_confidence_update else None,
        }"""

content = content.replace(old_to_props, new_to_props)

# We need to update _obj_to_memory
old_obj_to_mem = """            decay_factor=props.get("decay_factor", 1.0),
            canonical_id=props.get("canonical_id") or None,
            is_canonical=props.get("is_canonical", True),
        )"""

new_obj_to_mem = """            decay_factor=props.get("decay_factor", 1.0),
            canonical_id=props.get("canonical_id") or None,
            is_canonical=props.get("is_canonical", True),
            overall_confidence=props.get("overall_confidence", 0.5),
            confidence_factors=_parse_json_field(props, "confidence_factors", {}),
            provenance=_parse_json_field(props, "provenance", {}),
            modification_history=_parse_json_field(props, "modification_history", []),
            contradictions=props.get("contradictions", []),
            contradictions_resolved=props.get("contradictions_resolved", False),
            is_deprecated=props.get("is_deprecated", False),
            deprecated_by=props.get("deprecated_by") or None,
            supporting_evidence_ids=props.get("supporting_evidence_ids", []),
            contradicting_evidence_ids=props.get("contradicting_evidence_ids", []),
        )"""

# Add a quick helper before _obj_to_memory
helper = """
    def _parse_json_field(props: dict, key: str, default: Any) -> Any:
        val = props.get(key)
        if not val:
            return default
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return default
        return val

    def _obj_to_memory"""

# This won't work perfectly with string replace due to indent, let's do it cleaner
# Actually I'll just write a clean replace script
with open("client.py", "w") as f:
    f.write(content)
print("Updated client.py schema")
