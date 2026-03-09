# Weaviate Multi-Tenancy Guide

Reference for implementing multi-tenant architectures with Weaviate Python v4 client.

---

## Overview

Multi-tenancy enables data isolation between tenants within a single collection, providing:
- **Data Isolation**: Each tenant's data is completely separate
- **Resource Efficiency**: Shared infrastructure with isolated data
- **Scalability**: Add/remove tenants without schema changes
- **State Management**: Hot/Cold/Frozen states for cost optimization

---

## Enabling Multi-Tenancy

### Create Multi-Tenant Collection

```python
import weaviate
import weaviate.classes as wvc

client = weaviate.connect_to_local()

client.collections.create(
    name="Documents",
    multi_tenancy_config=wvc.config.Configure.multi_tenancy(enabled=True),
    properties=[
        wvc.config.Property(name="title", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
    ],
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(),
)
```

### With Auto-Tenant Creation

```python
client.collections.create(
    name="Documents",
    multi_tenancy_config=wvc.config.Configure.multi_tenancy(
        enabled=True,
        auto_tenant_creation=True  # Auto-create on first insert
    ),
    properties=[...]
)
```

### With Auto-Tenant Activation

```python
client.collections.create(
    name="Documents",
    multi_tenancy_config=wvc.config.Configure.multi_tenancy(
        enabled=True,
        auto_tenant_activation=True  # Auto-activate COLD tenants
    ),
    properties=[...]
)
```

---

## Tenant Management

### Create Tenants

```python
from weaviate.classes.tenants import Tenant

collection = client.collections.get("Documents")

# Single tenant
collection.tenants.create(Tenant(name="tenant_A"))

# Multiple tenants
collection.tenants.create([
    Tenant(name="tenant_A"),
    Tenant(name="tenant_B"),
    Tenant(name="tenant_C"),
])
```

### Create Tenants with Activity Status

```python
from weaviate.classes.tenants import Tenant, TenantActivityStatus

collection.tenants.create([
    Tenant(name="active_tenant", activity_status=TenantActivityStatus.HOT),
    Tenant(name="archive_tenant", activity_status=TenantActivityStatus.COLD),
])
```

### List Tenants

```python
tenants = collection.tenants.get()

for name, tenant in tenants.items():
    print(f"Tenant: {name}, Status: {tenant.activity_status}")
```

### Check If Tenant Exists

```python
tenants = collection.tenants.get()
if "tenant_A" in tenants:
    print("Tenant exists")
```

### Get Specific Tenant

```python
tenant = collection.tenants.get_by_name("tenant_A")
print(f"Status: {tenant.activity_status}")
```

### Delete Tenants

```python
# Single tenant
collection.tenants.remove("tenant_A")

# Multiple tenants
collection.tenants.remove(["tenant_A", "tenant_B"])
```

---

## Tenant Activity States

| State | Description | Data Access | Storage |
|-------|-------------|-------------|---------|
| **HOT** | Active, data in memory | Full read/write | Memory + Disk |
| **COLD** | Inactive, data on disk | Read-only (slow) | Disk only |
| **FROZEN** | Archived, data in cloud | No access | Cloud storage |
| **OFFLOADED** | Fully offloaded | No access | Cloud only |

### Update Tenant Status

```python
from weaviate.classes.tenants import Tenant, TenantActivityStatus

# Move to COLD (archive)
collection.tenants.update([
    Tenant(name="tenant_A", activity_status=TenantActivityStatus.COLD)
])

# Reactivate to HOT
collection.tenants.update([
    Tenant(name="tenant_A", activity_status=TenantActivityStatus.HOT)
])
```

### Bulk Status Update

```python
# Archive multiple tenants
cold_tenants = [
    Tenant(name=f"tenant_{i}", activity_status=TenantActivityStatus.COLD)
    for i in range(100)
]
collection.tenants.update(cold_tenants)
```

### Cost Optimization Strategy

```python
def optimize_tenant_storage(collection, inactive_days=30):
    """Move inactive tenants to COLD storage"""
    from datetime import datetime, timedelta

    cutoff = datetime.now() - timedelta(days=inactive_days)
    tenants = collection.tenants.get()

    to_archive = []
    for name, tenant in tenants.items():
        if tenant.activity_status == TenantActivityStatus.HOT:
            # Check last activity (you'd track this in your app)
            if should_archive(name, cutoff):
                to_archive.append(
                    Tenant(name=name, activity_status=TenantActivityStatus.COLD)
                )

    if to_archive:
        collection.tenants.update(to_archive)
```

---

## Working with Tenant Data

### Get Tenant-Specific Collection

```python
collection = client.collections.get("Documents")

# Get tenant-specific collection handle
tenant_collection = collection.with_tenant("tenant_A")
```

### Insert Data for Tenant

```python
tenant_collection = collection.with_tenant("tenant_A")

# Single insert
uuid = tenant_collection.data.insert({
    "title": "Document 1",
    "content": "Content for tenant A..."
})

# Batch insert
with tenant_collection.batch.dynamic() as batch:
    for doc in documents:
        batch.add_object({
            "title": doc["title"],
            "content": doc["content"]
        })
```

### Query Tenant Data

```python
tenant_collection = collection.with_tenant("tenant_A")

# Semantic search
response = tenant_collection.query.near_text(
    query="machine learning",
    limit=5
)

# Filtered search
from weaviate.classes.query import Filter

response = tenant_collection.query.fetch_objects(
    filters=Filter.by_property("title").like("*AI*"),
    limit=10
)

# Hybrid search
response = tenant_collection.query.hybrid(
    query="neural networks",
    limit=10,
    alpha=0.5
)
```

### Update Tenant Data

```python
tenant_collection = collection.with_tenant("tenant_A")

tenant_collection.data.update(
    uuid="object-uuid",
    properties={"title": "Updated Title"}
)
```

### Delete Tenant Data

```python
tenant_collection = collection.with_tenant("tenant_A")

# Single object
tenant_collection.data.delete_by_id("object-uuid")

# Bulk delete with filter
tenant_collection.data.delete_many(
    where=Filter.by_property("status").equal("archived")
)
```

---

## Cross-Tenant Operations

### Query Multiple Tenants

```python
def search_across_tenants(collection, tenant_names, query, limit_per_tenant=5):
    """Search across multiple tenants"""
    results = {}

    for tenant_name in tenant_names:
        tenant_col = collection.with_tenant(tenant_name)
        response = tenant_col.query.near_text(
            query=query,
            limit=limit_per_tenant
        )
        results[tenant_name] = response.objects

    return results
```

### Aggregate Across Tenants

```python
def count_all_tenants(collection):
    """Get object count per tenant"""
    tenants = collection.tenants.get()
    counts = {}

    for name, tenant in tenants.items():
        if tenant.activity_status == TenantActivityStatus.HOT:
            tenant_col = collection.with_tenant(name)
            response = tenant_col.aggregate.over_all(total_count=True)
            counts[name] = response.total_count

    return counts
```

### Migrate Data Between Tenants

```python
def migrate_tenant_data(collection, source_tenant, target_tenant):
    """Copy data from one tenant to another"""
    source = collection.with_tenant(source_tenant)
    target = collection.with_tenant(target_tenant)

    with target.batch.dynamic() as batch:
        for obj in source.iterator():
            batch.add_object(
                properties=obj.properties,
                vector=obj.vector
            )
```

---

## Multi-Tenant Architecture Patterns

### SaaS Application Pattern

```python
class TenantManager:
    def __init__(self, client, collection_name):
        self.client = client
        self.collection = client.collections.get(collection_name)

    def provision_tenant(self, tenant_id: str):
        """Create new tenant for customer"""
        self.collection.tenants.create(
            Tenant(name=tenant_id, activity_status=TenantActivityStatus.HOT)
        )

    def get_tenant_collection(self, tenant_id: str):
        """Get collection handle for tenant"""
        return self.collection.with_tenant(tenant_id)

    def archive_tenant(self, tenant_id: str):
        """Move tenant to cold storage"""
        self.collection.tenants.update([
            Tenant(name=tenant_id, activity_status=TenantActivityStatus.COLD)
        ])

    def delete_tenant(self, tenant_id: str):
        """Remove tenant and all data"""
        self.collection.tenants.remove(tenant_id)
```

### Project-Based Isolation

```python
def setup_project_tenancy(client, project_id: str):
    """Setup tenant for a new project"""
    collection = client.collections.get("ProjectDocuments")

    # Create tenant
    collection.tenants.create(
        Tenant(name=f"project_{project_id}")
    )

    return collection.with_tenant(f"project_{project_id}")
```

### User-Scoped Memory

```python
class UserMemoryStore:
    """Per-user memory isolation for AI agents"""

    def __init__(self, client):
        self.collection = client.collections.get("UserMemories")

    def ensure_user_tenant(self, user_id: str):
        """Create tenant if doesn't exist"""
        tenants = self.collection.tenants.get()
        if user_id not in tenants:
            self.collection.tenants.create(Tenant(name=user_id))

    def store_memory(self, user_id: str, memory: dict):
        """Store memory for user"""
        self.ensure_user_tenant(user_id)
        tenant_col = self.collection.with_tenant(user_id)
        return tenant_col.data.insert(memory)

    def recall_memories(self, user_id: str, query: str, limit: int = 5):
        """Recall relevant memories for user"""
        tenant_col = self.collection.with_tenant(user_id)
        return tenant_col.query.near_text(query=query, limit=limit)
```

---

## Best Practices

1. **Tenant Naming**: Use consistent, URL-safe naming (e.g., UUIDs, slugs)
2. **State Management**: Archive inactive tenants to COLD to save memory
3. **Batch Operations**: Use batch inserts for tenant data loading
4. **Error Handling**: Always verify tenant exists before operations
5. **Monitoring**: Track tenant counts and storage per tenant

### Tenant Naming Conventions

```python
import re

def sanitize_tenant_name(name: str) -> str:
    """Create safe tenant name"""
    # Remove special chars, lowercase
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
    return safe[:64]  # Max length

# Examples
sanitize_tenant_name("Company ABC")  # "company_abc"
sanitize_tenant_name("user@email.com")  # "user_email_com"
```

### Error Handling Pattern

```python
from weaviate.exceptions import WeaviateBaseError

def safe_tenant_operation(collection, tenant_name, operation):
    """Safely execute tenant operation"""
    try:
        tenants = collection.tenants.get()
        if tenant_name not in tenants:
            collection.tenants.create(Tenant(name=tenant_name))

        tenant_col = collection.with_tenant(tenant_name)
        return operation(tenant_col)

    except WeaviateBaseError as e:
        print(f"Tenant operation failed: {e}")
        return None
```

---

## References

- [Weaviate Multi-Tenancy Docs](https://weaviate.io/developers/weaviate/concepts/data#multi-tenancy)
- [Tenant Management API](https://weaviate.io/developers/weaviate/manage-data/multi-tenancy)
- [Multi-Tenancy Best Practices](https://weaviate.io/developers/weaviate/starter-guides/multi-tenancy)
