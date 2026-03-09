import sys

content = open("client.py").read()

# Update _ensure_schemas
old_props = """            Property(name="last_confidence_update", data_type=DataType.DATE, index_filterable=True),
        ]"""

new_props = """            Property(name="last_confidence_update", data_type=DataType.DATE, index_filterable=True),
            # Temporal & Event Modeling Features
            Property(name="temporal_bounds", data_type=DataType.TEXT), # JSON stringified
            Property(name="is_event", data_type=DataType.BOOL, index_filterable=True),
            Property(name="cause_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="effect_ids", data_type=DataType.TEXT_ARRAY),
        ]"""

content = content.replace(old_props, new_props)

# Update _memory_to_properties
old_to_props = """            "last_contradiction_check": memory.last_contradiction_check.isoformat() if memory.last_contradiction_check else None,
            "last_confidence_update": memory.last_confidence_update.isoformat() if memory.last_confidence_update else None,
        }"""

new_to_props = """            "last_contradiction_check": memory.last_contradiction_check.isoformat() if memory.last_contradiction_check else None,
            "last_confidence_update": memory.last_confidence_update.isoformat() if memory.last_confidence_update else None,
            "temporal_bounds": json.dumps(memory.temporal_bounds.dict() if hasattr(memory.temporal_bounds, 'dict') else memory.temporal_bounds) if memory.temporal_bounds else None,
            "is_event": memory.is_event,
            "cause_ids": memory.cause_ids,
            "effect_ids": memory.effect_ids,
        }"""

content = content.replace(old_to_props, new_to_props)

# Update _obj_to_memory
old_obj_to_mem = """            supporting_evidence_ids=props.get("supporting_evidence_ids", []),
            contradicting_evidence_ids=props.get("contradicting_evidence_ids", []),
            last_contradiction_check=None, # parsing dates is complex here, omitted for brevity as usually not needed in memory object
            last_confidence_update=None,
        )"""

new_obj_to_mem = """            supporting_evidence_ids=props.get("supporting_evidence_ids", []),
            contradicting_evidence_ids=props.get("contradicting_evidence_ids", []),
            last_contradiction_check=None,
            last_confidence_update=None,
            temporal_bounds=self._parse_json_field(props, "temporal_bounds", None),
            is_event=props.get("is_event", False),
            cause_ids=props.get("cause_ids", []),
            effect_ids=props.get("effect_ids", []),
        )"""

content = content.replace(old_obj_to_mem, new_obj_to_mem)

with open("client.py", "w") as f:
    f.write(content)
print("Updated client.py schema for Temporal Reasoning")
