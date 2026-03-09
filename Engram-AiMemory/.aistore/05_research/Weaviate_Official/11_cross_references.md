# Weaviate Cross-References Guide - Python v4 Client

Comprehensive documentation for managing relationships and cross-references in Weaviate using the Python v4 client library.

## Table of Contents

1. [Defining Reference Properties in Schema](#defining-reference-properties-in-schema)
2. [Adding References Between Objects](#adding-references-between-objects)
3. [Querying with References](#querying-with-references)
4. [Multi-Hop Reference Queries](#multi-hop-reference-queries)
5. [Reference Cardinality](#reference-cardinality)
6. [Deleting and Replacing References](#deleting-and-replacing-references)

---

## Defining Reference Properties in Schema

Reference properties allow you to create relationships between objects in different collections. In the Weaviate Python v4 client, reference properties are defined using the `Property` class with a dataType specifying the target collection.

### Basic Schema Definition

```python
from weaviate.classes.config import (
    Configure,
    Property,
    DataType,
)

# Define a collection with a reference property
article_schema = Configure.Collection(
    name="Article",
    properties=[
        Property(
            name="title",
            data_type=DataType.TEXT,
        ),
        Property(
            name="content",
            data_type=DataType.TEXT,
        ),
        Property(
            name="hasCategory",
            data_type=DataType.REFERENCE,
            target_collection="Category",  # Reference to Category collection
        ),
    ],
)

client.collections.create(article_schema)
```

### Multi-Target References (One Reference to Multiple Classes)

If you need a single property to reference multiple different collections, you can use multiple target collections:

```python
from weaviate.classes.config import (
    Configure,
    Property,
    DataType,
)

# Define a collection with multi-target references
document_schema = Configure.Collection(
    name="Document",
    properties=[
        Property(
            name="title",
            data_type=DataType.TEXT,
        ),
        Property(
            name="relatedEntities",
            data_type=DataType.REFERENCE,
            target_collection=["Person", "Organization", "Location"],
        ),
    ],
)

client.collections.create(document_schema)
```

### Reference Cardinality in Schema

Reference properties are arrays by default in Weaviate, which means they support one-to-many relationships. This is configured automatically and doesn't require explicit cardinality settings:

```python
# One Article can reference multiple Categories
property_config = Property(
    name="hasCategories",  # Plural to indicate multiple references
    data_type=DataType.REFERENCE,
    target_collection="Category",
)
# This property can hold multiple Category references by default
```

### Complete Schema Example

```python
from weaviate.classes.config import (
    Configure,
    Property,
    DataType,
)

# Create Article collection
article_schema = Configure.Collection(
    name="Article",
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
        Property(name="publishDate", data_type=DataType.DATE),
        Property(
            name="hasCategory",
            data_type=DataType.REFERENCE,
            target_collection="Category",
        ),
        Property(
            name="writtenBy",
            data_type=DataType.REFERENCE,
            target_collection="Author",
        ),
    ],
)

# Create Category collection
category_schema = Configure.Collection(
    name="Category",
    properties=[
        Property(name="name", data_type=DataType.TEXT),
        Property(name="description", data_type=DataType.TEXT),
    ],
)

# Create Author collection
author_schema = Configure.Collection(
    name="Author",
    properties=[
        Property(name="name", data_type=DataType.TEXT),
        Property(name="bio", data_type=DataType.TEXT),
    ],
)

client.collections.create(article_schema)
client.collections.create(category_schema)
client.collections.create(author_schema)
```

---

## Adding References Between Objects

After creating collections with reference properties, you can establish relationships between objects in different ways.

### Adding a Single Reference

Use `collection.data.reference_add()` to create a reference from one object to another:

```python
from weaviate.classes.data import DataReference

articles = client.collections.get("Article")
categories = client.collections.get("Category")

# First, create objects
article_uuid = articles.data.insert({
    "title": "Machine Learning Basics",
    "content": "An introduction to ML concepts...",
})

category_uuid = categories.data.insert({
    "name": "Technology",
    "description": "Articles about technology topics",
})

# Then add a reference from Article to Category
articles.data.reference_add(
    from_uuid=article_uuid,
    from_property="hasCategory",
    to=category_uuid,
)
```

### Adding Multiple References at Once

To add multiple references from a single object, call `reference_add()` multiple times or use batch operations:

```python
articles = client.collections.get("Article")

# Create article and categories
article_uuid = articles.data.insert({
    "title": "Web Development Guide",
    "content": "Learn web development...",
})

# Create multiple category references
category1_uuid = categories.data.insert({"name": "Web Development"})
category2_uuid = categories.data.insert({"name": "Programming"})
category3_uuid = categories.data.insert({"name": "Tutorial"})

# Add all references
articles.data.reference_add(
    from_uuid=article_uuid,
    from_property="hasCategory",
    to=category1_uuid,
)
articles.data.reference_add(
    from_uuid=article_uuid,
    from_property="hasCategory",
    to=category2_uuid,
)
articles.data.reference_add(
    from_uuid=article_uuid,
    from_property="hasCategory",
    to=category3_uuid,
)
```

### Batch Adding References

For bulk operations, use the batch API to add many references efficiently:

```python
articles = client.collections.get("Article")

with articles.batch.dynamic() as batch:
    # Add references in batch
    batch.reference_add(
        from_uuid="uuid-of-article-1",
        from_property="hasCategory",
        to="uuid-of-category-1",
    )
    batch.reference_add(
        from_uuid="uuid-of-article-1",
        from_property="hasCategory",
        to="uuid-of-category-2",
    )
    batch.reference_add(
        from_uuid="uuid-of-article-2",
        from_property="hasCategory",
        to="uuid-of-category-1",
    )
```

### Creating Objects with References

You can include references when inserting an object:

```python
articles = client.collections.get("Article")

# Insert article with references (requires category UUIDs)
article_uuid = articles.data.insert(
    properties={
        "title": "Python Programming",
        "content": "Learn Python...",
    },
    references={
        "hasCategory": ["category-uuid-1", "category-uuid-2"],
    },
)
```

---

## Querying with References

The `return_references` parameter allows you to include referenced objects in query results.

### Basic Return References

Use the `QueryReference` class to fetch cross-referenced objects:

```python
from weaviate.classes.query import QueryReference

articles = client.collections.get("Article")

# Query articles and include their category references
response = articles.query.fetch_objects(
    return_references=[
        QueryReference(
            link_on="hasCategory",
            return_properties=["name"],
        ),
    ],
    limit=5,
)

# Access the results
for article in response.objects:
    print(f"Article: {article.properties['title']}")

    # Access referenced categories
    if "hasCategory" in article.references:
        for category in article.references["hasCategory"].objects:
            print(f"  Category: {category.properties['name']}")
```

### Querying with Multiple Reference Properties

Return multiple reference properties in a single query:

```python
from weaviate.classes.query import QueryReference

articles = client.collections.get("Article")

response = articles.query.fetch_objects(
    return_references=[
        QueryReference(
            link_on="hasCategory",
            return_properties=["name", "description"],
        ),
        QueryReference(
            link_on="writtenBy",
            return_properties=["name", "bio"],
        ),
    ],
    limit=10,
)

for article in response.objects:
    print(f"Article: {article.properties['title']}")

    # Access categories
    if "hasCategory" in article.references:
        for category in article.references["hasCategory"].objects:
            print(f"  Category: {category.properties['name']}")

    # Access author
    if "writtenBy" in article.references:
        for author in article.references["writtenBy"].objects:
            print(f"  Author: {author.properties['name']}")
```

### Filtering on Referenced Properties

You can filter objects based on properties of their references:

```python
from weaviate.classes.query import Filter, QueryReference

articles = client.collections.get("Article")

# Find articles in the "Technology" category
response = articles.query.fetch_objects(
    where=Filter.by_ref(link_on="hasCategory").by_property("name").equal("Technology"),
    return_references=[
        QueryReference(link_on="hasCategory", return_properties=["name"]),
    ],
    limit=10,
)

for article in response.objects:
    print(f"{article.properties['title']} - in Technology category")
```

### Advanced Filter Syntax

Use complex filters with references:

```python
from weaviate.classes.query import Filter, QueryReference

articles = client.collections.get("Article")

# Complex filter: find articles with category names containing "tech"
response = articles.query.fetch_objects(
    where=Filter.by_ref(link_on="hasCategory").by_property("name").like("*tech*"),
    return_references=[
        QueryReference(link_on="hasCategory", return_properties=["name"]),
    ],
)
```

---

## Multi-Hop Reference Queries

Multi-hop queries follow references across multiple levels of relationships. This is useful for finding objects that are indirectly related through intermediate objects.

### Two-Level Reference Query

Query references of references (one level deep):

```python
from weaviate.classes.query import QueryReference

articles = client.collections.get("Article")

# Return categories and their properties
response = articles.query.fetch_objects(
    return_references=[
        QueryReference(
            link_on="hasCategory",
            return_properties=["name", "description"],
        ),
    ],
    limit=5,
)

# In the returned data, you can see all categories directly referenced by articles
for article in response.objects:
    print(f"Article: {article.properties['title']}")
    if "hasCategory" in article.references:
        for category in article.references["hasCategory"].objects:
            print(f"  - Category: {category.properties['name']}")
```

### Nested Reference Queries (Deep Traversal)

For queries that need to traverse multiple levels of references, you may need to execute multiple sequential queries:

```python
# Example: Get articles → their categories → parent of those categories

# Step 1: Get articles and their categories
articles = client.collections.get("Article")
article_response = articles.query.fetch_objects(
    return_references=[
        QueryReference(link_on="hasCategory", return_properties=["name"]),
    ],
    limit=5,
)

# Step 2: For each category, fetch its parent (if categories reference parent categories)
categories = client.collections.get("Category")
category_ids = set()

for article in article_response.objects:
    if "hasCategory" in article.references:
        for category in article.references["hasCategory"].objects:
            category_ids.add(category.uuid)

# Step 3: Query categories and their parent references
if category_ids:
    from weaviate.classes.query import Filter

    category_response = categories.query.fetch_objects(
        where=Filter.by_id().equal_any(list(category_ids)),
        return_references=[
            QueryReference(link_on="parentCategory", return_properties=["name"]),
        ],
    )

    for category in category_response.objects:
        print(f"Category: {category.properties['name']}")
        if "parentCategory" in category.references:
            for parent in category.references["parentCategory"].objects:
                print(f"  Parent: {parent.properties['name']}")
```

### Performance Considerations for Multi-Hop Queries

Important notes when working with multi-hop queries:

- **Performance Impact**: Queries involving cross-references can be slower than queries without them, especially at scale with multiple objects or complex queries.
- **Circular References**: If you have cycles within cross-references and perform nested queries, the request may fail. Ensure your reference structure is acyclic or handle cycles carefully.
- **Vector Search Limitation**: Cross-references do not affect vectors. You cannot use vector searches to directly filter based on reference properties. Use two separate queries instead.

**Example: Two-Query Alternative for Vector Search with References**

```python
from weaviate.classes.query import Filter, QueryReference

articles = client.collections.get("Article")
categories = client.collections.get("Category")

# Step 1: Vector search to find relevant categories
relevant_categories = categories.query.near_text(
    query="sports",
    limit=10,
)

category_ids = [cat.uuid for cat in relevant_categories.objects]

# Step 2: Find articles that reference these categories
articles_response = articles.query.fetch_objects(
    where=Filter.by_ref(link_on="hasCategory").by_id().equal_any(category_ids),
    return_references=[
        QueryReference(link_on="hasCategory", return_properties=["name"]),
    ],
)

for article in articles_response.objects:
    print(f"Found article: {article.properties['title']}")
```

---

## Reference Cardinality

Reference properties in Weaviate are arrays by default, supporting one-to-many relationships. This section explains how to work with different cardinality patterns.

### One-to-Many Relationships

One object references many objects of another type (the default behavior):

```python
# One Article can have multiple Categories
article_schema = Configure.Collection(
    name="Article",
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(
            name="hasCategories",  # Can hold multiple references
            data_type=DataType.REFERENCE,
            target_collection="Category",
        ),
    ],
)

articles = client.collections.get("Article")

# Add multiple category references to one article
article_uuid = articles.data.insert({"title": "AI and ML in Business"})

# Add multiple references
for category_uuid in [cat1_uuid, cat2_uuid, cat3_uuid]:
    articles.data.reference_add(
        from_uuid=article_uuid,
        from_property="hasCategories",
        to=category_uuid,
    )
```

### Many-to-Many Relationships

Both sides maintain multiple references (achieved through references in both directions):

```python
# Articles reference Categories
article_schema = Configure.Collection(
    name="Article",
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(
            name="hasCategories",
            data_type=DataType.REFERENCE,
            target_collection="Category",
        ),
    ],
)

# Categories reference Articles (inverse relationship)
category_schema = Configure.Collection(
    name="Category",
    properties=[
        Property(name="name", data_type=DataType.TEXT),
        Property(
            name="articles",  # Back-reference to articles
            data_type=DataType.REFERENCE,
            target_collection="Article",
        ),
    ],
)

# To establish many-to-many:
articles = client.collections.get("Article")
categories = client.collections.get("Category")

# Add forward reference
articles.data.reference_add(
    from_uuid=article_uuid,
    from_property="hasCategories",
    to=category_uuid,
)

# Add backward reference
categories.data.reference_add(
    from_uuid=category_uuid,
    from_property="articles",
    to=article_uuid,
)
```

### Querying Many-to-Many Relationships

```python
from weaviate.classes.query import QueryReference

# Get articles with their categories
articles = client.collections.get("Article")
article_response = articles.query.fetch_objects(
    return_references=[
        QueryReference(link_on="hasCategories", return_properties=["name"]),
    ],
    limit=10,
)

# Get categories with their articles
categories = client.collections.get("Category")
category_response = categories.query.fetch_objects(
    return_references=[
        QueryReference(link_on="articles", return_properties=["title"]),
    ],
    limit=10,
)
```

---

## Deleting and Replacing References

Manage references by deleting or replacing them as your data evolves.

### Deleting a Single Reference

Remove a specific reference between two objects:

```python
articles = client.collections.get("Article")

# Delete a single reference
articles.data.reference_delete(
    from_uuid="article-uuid",
    from_property="hasCategory",
    to="category-uuid",
)
```

### Deleting All References from a Property

To remove all references of a specific property from an object, delete them individually or use reference_replace with an empty list:

```python
articles = client.collections.get("Article")

# Method 1: Delete using reference_replace with empty list
articles.data.reference_replace(
    from_uuid="article-uuid",
    from_property="hasCategories",
    to=[],
)

# Method 2: Get all references and delete each one
article = articles.data.get_by_id("article-uuid", return_references=[
    QueryReference(link_on="hasCategories", return_properties=[])
])

if "hasCategories" in article.references:
    for ref_obj in article.references["hasCategories"].objects:
        articles.data.reference_delete(
            from_uuid="article-uuid",
            from_property="hasCategories",
            to=ref_obj.uuid,
        )
```

### Replacing References

Replace all references of a property with a new set of references:

```python
articles = client.collections.get("Article")

# Replace all existing category references with new ones
articles.data.reference_replace(
    from_uuid="article-uuid",
    from_property="hasCategories",
    to=["new-category-uuid-1", "new-category-uuid-2"],
)
```

### Batch Deleting References

Use batch operations for efficient bulk deletion:

```python
articles = client.collections.get("Article")

with articles.batch.dynamic() as batch:
    # Delete multiple references
    batch.reference_delete(
        from_uuid="article-uuid-1",
        from_property="hasCategory",
        to="category-uuid-1",
    )
    batch.reference_delete(
        from_uuid="article-uuid-1",
        from_property="hasCategory",
        to="category-uuid-2",
    )
    batch.reference_delete(
        from_uuid="article-uuid-2",
        from_property="hasCategory",
        to="category-uuid-1",
    )
```

### Complete Reference Lifecycle Example

```python
from weaviate.classes.query import QueryReference

articles = client.collections.get("Article")
categories = client.collections.get("Category")

# 1. Create objects
article_uuid = articles.data.insert({
    "title": "Data Science",
    "content": "Learn data science concepts...",
})

tech_uuid = categories.data.insert({"name": "Technology"})
data_uuid = categories.data.insert({"name": "Data"})
science_uuid = categories.data.insert({"name": "Science"})

# 2. Add references
articles.data.reference_add(from_uuid=article_uuid, from_property="hasCategories", to=tech_uuid)
articles.data.reference_add(from_uuid=article_uuid, from_property="hasCategories", to=data_uuid)
articles.data.reference_add(from_uuid=article_uuid, from_property="hasCategories", to=science_uuid)

# 3. Query references
response = articles.query.fetch_objects(
    return_references=[
        QueryReference(link_on="hasCategories", return_properties=["name"]),
    ],
    limit=1,
)

print("Current categories:", [cat.properties["name"] for cat in response.objects[0].references["hasCategories"].objects])

# 4. Replace references (keep only Technology and Data)
articles.data.reference_replace(
    from_uuid=article_uuid,
    from_property="hasCategories",
    to=[tech_uuid, data_uuid],
)

# 5. Delete a reference
articles.data.reference_delete(
    from_uuid=article_uuid,
    from_property="hasCategories",
    to=data_uuid,
)

# 6. Verify final state
final_response = articles.query.fetch_objects(
    return_references=[
        QueryReference(link_on="hasCategories", return_properties=["name"]),
    ],
    limit=1,
)

print("Final categories:", [cat.properties["name"] for cat in final_response.objects[0].references["hasCategories"].objects])
```

---

## Best Practices and Tips

### Design Considerations

1. **Reference vs Embedding**: Consider whether to use cross-references or embed data. For large datasets, cross-references are more efficient.

2. **Avoid Circular References**: While possible, circular reference structures can cause query failures when used with nested traversal.

3. **One Directional by Default**: Create references in the direction that makes the most semantic sense. Use bidirectional references only when necessary for query patterns.

4. **Index Your References**: If you frequently filter on reference properties, ensure proper indexing for performance.

### Performance Tips

1. **Batch Operations**: Always use batch operations for bulk reference additions/deletions rather than individual calls.

2. **Selective Property Return**: Only return the properties you need from referenced objects to reduce payload size.

3. **Limit Nesting Depth**: Avoid deeply nested reference queries; use sequential queries instead for better performance.

4. **Consider Data Duplication**: For frequently accessed properties, consider duplicating them in the referencing object to avoid query overhead.

### Error Handling

```python
from weaviate.exceptions import WeaviateException

articles = client.collections.get("Article")

try:
    articles.data.reference_add(
        from_uuid="non-existent-uuid",
        from_property="hasCategories",
        to="category-uuid",
    )
except WeaviateException as e:
    print(f"Error adding reference: {e}")
```

---

## Resources

- [Weaviate Cross-References Documentation](https://docs.weaviate.io/weaviate/manage-collections/cross-references)
- [Python v4 Client Documentation](https://docs.weaviate.io/weaviate/client-libraries/python)
- [Weaviate Python Client GitHub Repository](https://github.com/weaviate/weaviate-python-client)
- [Weaviate Tutorial: Manage Relationships with Cross-References](https://docs.weaviate.io/weaviate/tutorials/cross-references)

