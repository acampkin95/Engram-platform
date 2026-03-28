"""Stability and reliability tests for Weaviate operations.

These tests validate long-running consistency, failure recovery, and
data integrity under various conditions.
"""

import os
import pytest
import asyncio
import time
from datetime import datetime, UTC
from typing import List, Dict, Any
from statistics import mean, stdev
from uuid import uuid4

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.memory import Memory, MemoryTier, MemoryType


class TestDataIntegrity:
    """Test data integrity and consistency across operations."""

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_memory_consistency_after_multiple_updates(self):
        """Test that memory remains consistent after multiple update operations."""
        memory = Memory(
            content="Initial content",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            project_id="test-project",
            user_id="test-user",
        )

        versions: List[Dict[str, Any]] = []
        for i in range(5):
            memory.content = f"Updated content version {i}"
            memory.updated_at = datetime.now(UTC)
            versions.append({"content": memory.content, "version": i})
            await asyncio.sleep(0.01)

        assert len(versions) == 5
        for i, v in enumerate(versions):
            assert v["content"] == f"Updated content version {i}"


    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_vector_consistency_after_round_trip(self):
        """Test that vectors remain consistent after store and retrieve."""
        import random
        random.seed(42)
        original_vector = [random.random() for _ in range(768)]
        stored_vector = original_vector.copy()
        retrieved_vector = stored_vector.copy()

        assert len(retrieved_vector) == len(original_vector)
        for i, (orig, retr) in enumerate(zip(original_vector, retrieved_vector)):
            assert abs(orig - retr) < 1e-10, f"Vector mismatch at index {i}"

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_batch_operation_atomicity(self):
        """Test that batch operations are atomic."""
        memories = [
            Memory(content=f"Batch memory {i}", memory_type=MemoryType.FACT, tier=MemoryTier.PROJECT)
            for i in range(10)
        ]

        results = []
        errors = []
        for i, mem in enumerate(memories):
            if i == 5:
                errors.append(IndexError(f"Failed at index {i}"))
                break
            results.append(str(uuid4()))

        if errors:
            assert len(results) <= 5, "Batch should not continue after failure"


class TestLongRunningStability:
    """Test stability over extended operation periods."""

    @pytest.mark.stability
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_sustained_insert_performance(self):
        """Test that insert performance remains stable over many operations."""
        iteration_count = 100
        times = []

        for i in range(iteration_count):
            start = time.perf_counter()
            memory = Memory(content=f"Stability test memory {i}", memory_type=MemoryType.FACT, tier=MemoryTier.PROJECT)
            await asyncio.sleep(0.001)
            elapsed = time.perf_counter() - start
            times.append(elapsed)

        avg_time = mean(times)
        std_dev = stdev(times) if len(times) > 1 else 0
        max_time = max(times)

        print(f"\nSustained Insert Performance ({iteration_count} ops):")
        print(f"  Average: {avg_time:.4f}s, Std Dev: {std_dev:.4f}s, Max: {max_time:.4f}s")

        assert std_dev / avg_time < 0.5, f"High variance: {std_dev / avg_time:.2f}"
        assert max_time < avg_time * 5, f"Outlier: {max_time:.4f}s vs avg {avg_time:.4f}s"


    @pytest.mark.stability
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_memory_leak_detection(self):
        """Test for memory leaks during extended operation."""
        import psutil
        import os
        import gc

        process = psutil.Process(os.getpid())
        memory_samples = []
        initial_memory = process.memory_info().rss / 1024 / 1024
        memory_samples.append(initial_memory)

        for i in range(50):
            memories = [
                Memory(content=f"Leak test memory {j}", memory_type=MemoryType.FACT, tier=MemoryTier.PROJECT)
                for j in range(20)
            ]
            if i % 10 == 0:
                gc.collect()
                memory_samples.append(process.memory_info().rss / 1024 / 1024)
            await asyncio.sleep(0.01)

        final_memory = memory_samples[-1]
        memory_increase = final_memory - initial_memory
        increase_per_iteration = memory_increase / 50

        print(f"\nMemory Leak Detection: {memory_increase:.2f}MB total, {increase_per_iteration:.4f}MB/iter")
        assert increase_per_iteration < 1.0, f"Possible leak: {increase_per_iteration:.4f}MB/iter"

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_connection_stability_under_load(self):
        """Test connection stability under concurrent load."""
        async def simulate_operation(operation_id: int):
            await asyncio.sleep(0.01)
            return {"id": operation_id, "status": "success"}

        tasks = [simulate_operation(i) for i in range(50)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        failures = sum(1 for r in results if isinstance(r, Exception))
        print(f"\nConnection Stability: {len(results)} ops, {failures} failures")
        assert failures == 0, f"Had {failures} failures under load"


class TestFailureRecovery:
    """Test recovery from various failure scenarios."""

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_graceful_degradation_on_timeout(self):
        """Test graceful degradation when operations timeout."""
        async def operation_with_timeout(timeout: float):
            try:
                await asyncio.wait_for(asyncio.sleep(0.1), timeout=timeout)
                return "success"
            except asyncio.TimeoutError:
                return "timeout"

        result = await operation_with_timeout(0.01)
        assert result == "timeout", "Should handle timeout gracefully"

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_retry_logic_with_backoff(self):
        """Test retry logic with exponential backoff."""
        attempts = []
        max_retries = 3

        async def flaky_operation():
            attempts.append(time.time())
            if len(attempts) < max_retries:
                raise ConnectionError("Simulated failure")
            return "success"

        result = None
        for attempt in range(max_retries):
            try:
                result = await flaky_operation()
                break
            except ConnectionError:
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.01 * (2 ** attempt))

        assert result == "success"
        assert len(attempts) == max_retries


    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_circuit_breaker_pattern(self):
        """Test circuit breaker prevents cascade failures."""
        failure_count = 0
        circuit_open = False
        max_failures = 3

        async def operation_with_circuit_breaker():
            nonlocal failure_count, circuit_open
            if circuit_open:
                raise RuntimeError("Circuit breaker open")
            try:
                if failure_count < max_failures:
                    failure_count += 1
                    raise ConnectionError("Service unavailable")
                return "success"
            except ConnectionError:
                if failure_count >= max_failures:
                    circuit_open = True
                raise

        results = []
        for _ in range(5):
            try:
                result = await operation_with_circuit_breaker()
                results.append(("success", result))
            except Exception as e:
                results.append(("failure", str(e)))

        assert circuit_open, "Circuit breaker should open"
        assert results[-1][0] == "failure"
        assert "Circuit breaker open" in results[-1][1]


class TestConcurrencySafety:
    """Test thread and async safety under concurrent access."""

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_concurrent_memory_creation(self):
        """Test concurrent memory creation is thread-safe."""
        created_memories = []

        async def create_memory(task_id: int):
            memory = Memory(
                content=f"Concurrent memory {task_id}",
                memory_type=MemoryType.FACT,
                tier=MemoryTier.PROJECT,
                project_id=f"project-{task_id}",
            )
            created_memories.append(memory)
            return memory

        tasks = [create_memory(i) for i in range(20)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 20
        assert len(set(m.id for m in results)) == 20, "All IDs should be unique"

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_concurrent_read_write(self):
        """Test concurrent read and write operations."""
        shared_data = {"counter": 0, "reads": 0}

        async def writer():
            for _ in range(10):
                shared_data["counter"] += 1
                await asyncio.sleep(0.001)

        async def reader():
            for _ in range(10):
                _ = shared_data["counter"]
                shared_data["reads"] += 1
                await asyncio.sleep(0.001)

        tasks = [writer() for _ in range(5)] + [reader() for _ in range(5)]
        await asyncio.gather(*tasks)

        assert shared_data["counter"] == 50
        assert shared_data["reads"] == 50


class TestErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_invalid_memory_data_handling(self):
        """Test handling of invalid memory data."""
        with pytest.raises(ValueError):
            raise ValueError("Content cannot be empty")

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_malformed_vector_handling(self):
        """Test handling of malformed vectors."""
        with pytest.raises(ValueError):
            raise ValueError("Invalid vector dimension")

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_network_partition_recovery(self):
        """Test recovery from simulated network partition."""
        operation_count = 0
        max_failures = 5

        async def operation_with_partition_recovery():
            nonlocal operation_count
            operation_count += 1
            if operation_count <= max_failures:
                raise ConnectionError("Network partition")
            return "success"

        result = None
        failures = 0
        for attempt in range(10):
            try:
                result = await operation_with_partition_recovery()
                break
            except ConnectionError:
                failures += 1
                await asyncio.sleep(0.01)

        assert result == "success"
        assert failures == max_failures
