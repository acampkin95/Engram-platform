# Weaviate Data Operations Guide

Comprehensive reference for CRUD operations using Weaviate Python v4 client.

---

## Single Object Operations

### Insert Object

```python
import weaviate
import weaviate.classes as wvc

client = weaviate.connect_to_local()
collection = client.collections.get("Articles")

# Basic insert
uuid = collection.data.insert({
    "title": "Machine Learning Basics",
    "content": "Introduction to ML concepts...",
    "author": "Jane Doe",
    "published": "2024-01-30",
    "views": 1250
})
print(f"Created: {uuid}")
```

### Insert with Custom UUID

```python
from uuid import uuid4

custom_uuid = str(uuid4())

uuid = collection.data.insert(
    properties={
        "title": "Custom ID Document",
        "content": "Content here..."
    },
    uuid=custom_uuid
)
```

### Insert with Vector

```python
# When using your own embeddings
embedding = [0.1, 0.2, 0.3, ...]  # Your pre-computed vector

uuid = collection.data.insert(
    properties={"title": "Pre-embedded", "content": "..."},
    vector=embedding
)
```

### Insert with Named Vectors

```python
# For multi-vector collections
uuid = collection.data.insert(
    properties={"title": "Multi-vector doc"},
    vector={
        "title_vector": [0.1, 0.2, ...],
        "content_vector": [0.3, 0.4, ...]
    }
)
```

### Insert with References

```python
# Create object with cross-reference
author_uuid = "author-uuid-here"

uuid = collection.data.insert(
    properties={"title": "Article with Author"},
    references={"hasAuthor": author_uuid}
)
```

---

## Fetch Operations

### Fetch by UUID

```python
obj = collection.query.fetch_object_by_id("object-uuid")
print(obj.properties)
print(obj.uuid)
```

### Fetch with Vector

```python
obj = collection.query.fetch_object_by_id(
    "object-uuid",
    include_vector=True
)
print(obj.vector)
```

### Fetch with Metadata

```python
from weaviate.classes.query import MetadataQuery

obj = collection.query.fetch_object_by_id(
    "object-uuid",
    return_metadata=MetadataQuery(
        creation_time=True,
        update_time=True
    )
)
print(f"Created: {obj.metadata.creation_time}")
```

### Check If Object Exists

```python
try:
    obj = collection.query.fetch_object_by_id("object-uuid")
    exists = obj is not None
except Exception:
    exists = False
```

---

## Update Operations

### Update Properties (Partial)

```python
# Only updates specified properties
collection.data.update(
    uuid="object-uuid",
    properties={"views": 5000, "title": "Updated Title"}
)
```

### Replace Object (Full)

```python
# Replaces all properties
collection.data.replace(
    uuid="object-uuid",
    properties={
        "title": "Completely New Title",
        "content": "Completely new content",
        "author": "New Author",
        "views": 0
    }
)
```

### Update Vector

```python
new_embedding = [0.5, 0.6, 0.7, ...]

collection.data.update(
    uuid="object-uuid",
    vector=new_embedding
)
```

### Update Properties and Vector

```python
collection.data.update(
    uuid="object-uuid",
    properties={"title": "Updated"},
    vector=[0.1, 0.2, 0.3, ...]
)
```

### Add/Update Reference

```python
collection.data.reference_add(
    from_uuid="article-uuid",
    from_property="hasAuthor",
    to=["author-uuid"]
)
```

### Remove Reference

```python
collection.data.reference_delete(
    from_uuid="article-uuid",
    from_property="hasAuthor",
    to="author-uuid"
)
```

### Replace All References

```python
collection.data.reference_replace(
    from_uuid="article-uuid",
    from_property="hasAuthor",
    to=["new-author-uuid"]
)
```

---

## Delete Operations

### Delete by UUID

```python
collection.data.delete_by_id("object-uuid")
```

### Delete Many with Filter

```python
from weaviate.classes.query import Filter

# Delete all matching objects
result = collection.data.delete_many(
    where=Filter.by_property("status").equal("archived")
)
print(f"Deleted: {result.successful} objects")
```

### Delete with Complex Filter

```python
result = collection.data.delete_many(
    where=(
        Filter.by_property("views").less_than(10)
        & Filter.by_property("published").less_than("2023-01-01")
    )
)
```

### Dry Run Delete

```python
# Check what would be deleted without deleting
result = collection.data.delete_many(
    where=Filter.by_property("status").equal("draft"),
    dry_run=True
)
print(f"Would delete: {result.matches} objects")
```

### Delete with Verbose Output

```python
result = collection.data.delete_many(
    where=Filter.by_property("category").equal("temp"),
    verbose=True
)

for obj in result.objects:
    print(f"Deleted: {obj.uuid}")
```

---

## Batch Operations

### Dynamic Batch (Recommended)

```python
# Automatically adjusts batch size based on server response
with collection.batch.dynamic() as batch:
    for item in large_dataset:
        batch.add_object({
            "title": item["title"],
            "content": item["content"]
        })

    # Check for errors
    if batch.number_errors > 0:
        print(f"Errors: {batch.number_errors}")
```

### Fixed Size Batch

```python
# Fixed batch size
with collection.batch.fixed_size(batch_size=100) as batch:
    for item in dataset:
        batch.add_object(item)
```

### Rate Limited Batch

```python
# Respect API rate limits
with collection.batch.rate_limit(requests_per_minute=60) as batch:
    for item in dataset:
        batch.add_object(item)
```

### Batch with Custom UUID

```python
with collection.batch.dynamic() as batch:
    for item in dataset:
        batch.add_object(
            properties=item["properties"],
            uuid=item["id"]
        )
```

### Batch with Vectors

```python
with collection.batch.dynamic() as batch:
    for item in dataset:
        batch.add_object(
            properties={"content": item["text"]},
            vector=item["embedding"]
        )
```

### Batch with References

```python
with collection.batch.dynamic() as batch:
    for item in dataset:
        batch.add_object(
            properties=item["properties"],
            references={"belongsTo": item["category_uuid"]}
        )
```

### Batch Error Handling

```python
with collection.batch.dynamic() as batch:
    for item in dataset:
        batch.add_object(item)

# After batch context exits
if batch.number_errors > 0:
    print(f"Total errors: {batch.number_errors}")

    for error in batch.failed_objects:
        print(f"UUID: {error.original_uuid}")
        print(f"Error: {error.message}")
```

### Batch Progress Tracking

```python
total = len(dataset)

with collection.batch.dynamic() as batch:
    for i, item in enumerate(dataset):
        batch.add_object(item)

        if (i + 1) % 1000 == 0:
            print(f"Progress: {i + 1}/{total}")
```

---

## Iterator Pattern

### Iterate All Objects

```python
for obj in collection.iterator():
    print(obj.uuid, obj.properties)
```

### Iterate with Vectors

```python
for obj in collection.iterator(include_vector=True):
    print(obj.uuid, len(obj.vector))
```

### Iterate Specific Properties

```python
for obj in collection.iterator(return_properties=["title", "author"]):
    print(obj.properties)
```

### Iterate with Metadata

```python
from weaviate.classes.query import MetadataQuery

for obj in collection.iterator(
    return_metadata=MetadataQuery(creation_time=True)
):
    print(obj.metadata.creation_time)
```

### Export All Data

```python
def export_collection(collection, output_file):
    """Export all collection data to JSON"""
    import json

    data = []
    for obj in collection.iterator(include_vector=True):
        data.append({
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "vector": obj.vector
        })

    with open(output_file, "w") as f:
        json.dump(data, f)

    return len(data)
```

---

## Import/Export Patterns

### Import from JSON

```python
import json

def import_from_json(collection, filepath):
    """Import data from JSON file"""
    with open(filepath) as f:
        data = json.load(f)

    with collection.batch.dynamic() as batch:
        for item in data:
            batch.add_object(
                properties=item.get("properties", item),
                uuid=item.get("uuid"),
                vector=item.get("vector")
            )

    return len(data)
```

### Import from CSV

```python
import csv

def import_from_csv(collection, filepath, text_fields):
    """Import data from CSV file"""
    with open(filepath) as f:
        reader = csv.DictReader(f)

        with collection.batch.dynamic() as batch:
            count = 0
            for row in reader:
                batch.add_object(row)
                count += 1

    return count
```

### Backup Collection

```python
def backup_collection(client, collection_name, backup_path):
    """Backup entire collection"""
    collection = client.collections.get(collection_name)

    # Get schema
    config = collection.config.get()

    # Export data
    data = []
    for obj in collection.iterator(include_vector=True):
        data.append({
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "vector": list(obj.vector) if obj.vector else None
        })

    backup = {
        "collection_name": collection_name,
        "object_count": len(data),
        "data": data
    }

    import json
    with open(backup_path, "w") as f:
        json.dump(backup, f)

    return len(data)
```

### Restore Collection

```python
def restore_collection(client, backup_path):
    """Restore collection from backup"""
    import json

    with open(backup_path) as f:
        backup = json.load(f)

    collection = client.collections.get(backup["collection_name"])

    with collection.batch.dynamic() as batch:
        for item in backup["data"]:
            batch.add_object(
                properties=item["properties"],
                uuid=item["uuid"],
                vector=item.get("vector")
            )

    return backup["object_count"]
```

---

## Error Handling Patterns

### Graceful Insert

```python
from weaviate.exceptions import WeaviateBaseError

def safe_insert(collection, properties, uuid=None):
    """Insert with error handling"""
    try:
        return collection.data.insert(
            properties=properties,
            uuid=uuid
        )
    except WeaviateBaseError as e:
        print(f"Insert failed: {e}")
        return None
```

### Retry Pattern

```python
import time
from weaviate.exceptions import WeaviateBaseError

def insert_with_retry(collection, properties, max_retries=3):
    """Insert with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return collection.data.insert(properties)
        except WeaviateBaseError as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f"Retry in {wait}s: {e}")
                time.sleep(wait)
            else:
                raise
```

### Upsert Pattern

```python
def upsert(collection, uuid, properties):
    """Insert or update object"""
    try:
        # Try to fetch existing
        existing = collection.query.fetch_object_by_id(uuid)
        if existing:
            collection.data.update(uuid=uuid, properties=properties)
            return "updated"
    except Exception:
        pass

    # Insert new
    collection.data.insert(properties=properties, uuid=uuid)
    return "inserted"
```

### Idempotent Batch Insert

```python
def idempotent_batch_insert(collection, items, id_field="id"):
    """Skip existing objects during batch insert"""
    # Get existing UUIDs
    existing_uuids = set()
    for obj in collection.iterator(return_properties=[]):
        existing_uuids.add(str(obj.uuid))

    # Insert only new items
    with collection.batch.dynamic() as batch:
        for item in items:
            item_uuid = item.get(id_field)
            if item_uuid and item_uuid not in existing_uuids:
                batch.add_object(
                    properties=item,
                    uuid=item_uuid
                )
```

---

## Performance Tips

1. **Use Batch Operations**: Always use batch for multiple inserts
2. **Dynamic Batch**: Prefer `batch.dynamic()` for automatic optimization
3. **Iterator for Large Data**: Use iterator instead of fetch_objects for full exports
4. **Limit Return Fields**: Only request needed properties
5. **Skip Vectors**: Don't include vectors unless needed

### Optimized Bulk Operations

```python
# Fast bulk insert
def fast_bulk_insert(collection, items):
    """Optimized bulk insert"""
    with collection.batch.dynamic() as batch:
        for item in items:
            batch.add_object(item)

    return batch.number_errors == 0

# Fast count
def fast_count(collection):
    """Get object count without fetching data"""
    response = collection.aggregate.over_all(total_count=True)
    return response.total_count
```

---

## References

- [Weaviate Data Management](https://weaviate.io/developers/weaviate/manage-data)
- [Batch Import Guide](https://weaviate.io/developers/weaviate/manage-data/import)
- [Python Client Reference](https://weaviate-python-client.readthedocs.io/)
