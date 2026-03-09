import sys

content = open("packages/core/src/memory_system/client.py").read()

# Need to add temporal filters to search
filter_block = """            if query.tags:
                for tag in query.tags:
                    filters.append(Filter.by_property("tags").contains_any([tag]))"""

new_filter_block = """            if query.tags:
                for tag in query.tags:
                    filters.append(Filter.by_property("tags").contains_any([tag]))
            
            if query.event_only:
                filters.append(Filter.by_property("is_event").equal(True))
            
            if query.start_date:
                # Weaviate date filters need RFC3339 string format usually, but Python date objects work in v4 client
                filters.append(Filter.by_property("created_at").greater_or_equal(query.start_date))
                
            if query.end_date:
                filters.append(Filter.by_property("created_at").less_or_equal(query.end_date))"""

content = content.replace(filter_block, new_filter_block)
open("packages/core/src/memory_system/client.py", "w").write(content)
print("Updated client.py search filters")
