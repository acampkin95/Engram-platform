import sys

content = open("memory_system/decay.py").read()

new_method = '''
    def calculate_decay(
        self,
        created_at: datetime,
        last_accessed: datetime | None,
        access_count: int,
        access_boost: float = 0.1,
        min_importance: float = 0.1,
        now: datetime | None = None,
    ) -> float:
        """Calculate the combined decay factor based on time and access count."""
        now = now or datetime.now(UTC)
        reference_time = last_accessed or created_at
        if reference_time and reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=UTC)
        if reference_time:
            days_since = (now - reference_time).total_seconds() / 86400.0
            decay = math.exp(-math.log(2) * max(0, days_since) / self.half_life_days)
        else:
            decay = 1.0
        access_factor = min(2.0, 1.0 + (access_count * access_boost))
        return max(min_importance, decay * access_factor)

    def calculate_memory_fitness(
'''

content = content.replace("    def calculate_memory_fitness(", new_method)
open("memory_system/decay.py", "w").write(content)
print("done")
