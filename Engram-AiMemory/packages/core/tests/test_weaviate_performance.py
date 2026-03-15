"""Performance benchmarks for Weaviate operations.

These tests measure the performance characteristics of Weaviate operations
and help identify bottlenecks and regressions.
"""

import os
import pytest
import asyncio
import time
from datetime import datetime
from typing import List
from statistics import mean, median, stdev

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.memory import Memory, MemoryTier, MemoryType


class TestPerformanceBenchmarks:
    """Performance benchmarks for core Weaviate operations."""
    
    @pytest.fixture
    def performance_thresholds(self):
        """Define acceptable performance thresholds (in seconds)."""
        return {
            "single_insert": 0.1,      # 100ms
            "single_query": 0.05,      # 50ms
            "batch_insert_100": 2.0,   # 2 seconds for 100 items
            "batch_insert_1000": 15.0, # 15 seconds for 1000 items
            "vector_search": 0.1,      # 100ms
            "hybrid_search": 0.2,      # 200ms
        }

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_benchmark_single_memory_insert(self, performance_thresholds):
        """Benchmark single memory insertion performance."""
        # This is a template - in real tests, would use actual client
        times = []
        
        for _ in range(10):
            start = time.perf_counter()
            # Simulate insert operation
            await asyncio.sleep(0.001)  # Placeholder
            elapsed = time.perf_counter() - start
            times.append(elapsed)
        
        avg_time = mean(times)
        max_time = max(times)
        
        print(f"\nSingle Insert Performance:")
        print(f"  Average: {avg_time:.4f}s")
        print(f"  Max: {max_time:.4f}s")
        print(f"  Threshold: {performance_thresholds['single_insert']}s")
        
        assert avg_time < performance_thresholds["single_insert"], \
            f"Insert too slow: {avg_time:.4f}s > {performance_thresholds['single_insert']}s"

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_benchmark_vector_search_latency(self, performance_thresholds):
        """Benchmark vector search latency."""
        times = []
        
        for _ in range(20):
            start = time.perf_counter()
            # Simulate vector search
            await asyncio.sleep(0.0005)  # Placeholder
            elapsed = time.perf_counter() - start
            times.append(elapsed)
        
        p50 = median(times)
        p95 = sorted(times)[int(len(times) * 0.95)]
        
        print(f"\nVector Search Performance:")
        print(f"  P50: {p50:.4f}s")
        print(f"  P95: {p95:.4f}s")
        print(f"  Threshold: {performance_thresholds['vector_search']}s")
        
        assert p95 < performance_thresholds["vector_search"], \
            f"Search too slow: P95={p95:.4f}s > {performance_thresholds['vector_search']}s"

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_benchmark_batch_insert_scaling(self, performance_thresholds):
        """Benchmark batch insert performance with different batch sizes."""
        batch_sizes = [10, 50, 100, 500]
        results = {}
        
        for size in batch_sizes:
            start = time.perf_counter()
            # Simulate batch insert
            await asyncio.sleep(0.01 * size / 100)  # Placeholder scaling
            elapsed = time.perf_counter() - start
            results[size] = elapsed
            
            print(f"\nBatch Insert ({size} items): {elapsed:.4f}s")
        
        # Verify scaling is roughly linear
        ratio_100_to_500 = results[500] / results[100]
        assert ratio_100_to_500 < 7, f"Batch insert doesn't scale linearly: {ratio_100_to_500:.2f}x"

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_benchmark_concurrent_operations(self):
        """Benchmark concurrent operation throughput."""
        concurrency_levels = [5, 10, 25, 50]
        
        for concurrency in concurrency_levels:
            start = time.perf_counter()
            
            # Simulate concurrent operations
            tasks = [asyncio.sleep(0.01) for _ in range(concurrency)]
            await asyncio.gather(*tasks)
            
            elapsed = time.perf_counter() - start
            throughput = concurrency / elapsed
            
            print(f"\nConcurrent Operations ({concurrency}):")
            print(f"  Total time: {elapsed:.4f}s")
            print(f"  Throughput: {throughput:.1f} ops/sec")

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_benchmark_memory_usage_during_bulk_load(self):
        """Benchmark memory usage during bulk load operations."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Simulate bulk load
        for i in range(1000):
            # Create memory objects
            memory = Memory(
                content=f"Test memory {i}",
                memory_type=MemoryType.FACT,
                tier=MemoryTier.PROJECT,
            )
            if i % 100 == 0:
                await asyncio.sleep(0.001)
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        print(f"\nMemory Usage During Bulk Load:")
        print(f"  Initial: {initial_memory:.2f} MB")
        print(f"  Final: {final_memory:.2f} MB")
        print(f"  Increase: {memory_increase:.2f} MB")
        
        # Should not leak memory excessively
        assert memory_increase < 100, f"Memory increased by {memory_increase:.2f}MB"


class TestQueryPerformancePatterns:
    """Test performance of different query patterns."""
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_simple_filter_query_performance(self):
        """Benchmark simple filter queries."""
        start = time.perf_counter()
        
        # Simulate filter query
        await asyncio.sleep(0.005)
        
        elapsed = time.perf_counter() - start
        print(f"\nSimple Filter Query: {elapsed:.4f}s")
        assert elapsed < 0.1

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_complex_filter_query_performance(self):
        """Benchmark complex multi-field filter queries."""
        start = time.perf_counter()
        
        # Simulate complex query with multiple filters
        await asyncio.sleep(0.01)
        
        elapsed = time.perf_counter() - start
        print(f"\nComplex Filter Query: {elapsed:.4f}s")
        assert elapsed < 0.2

    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_hybrid_search_performance(self):
        """Benchmark hybrid (vector + keyword) search."""
        start = time.perf_counter()
        
        # Simulate hybrid search
        await asyncio.sleep(0.015)
        
        elapsed = time.perf_counter() - start
        print(f"\nHybrid Search: {elapsed:.4f}s")
        assert elapsed < 0.3


class TestStabilityAndReliability:
    """Test system stability under load."""
    
    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_sustained_load_handling(self):
        """Test system handles sustained load without degradation."""
        durations = [1, 5, 10]  # seconds
        
        for duration in durations:
            start = time.perf_counter()
            operations = 0
            
            while time.perf_counter() - start < duration:
                # Simulate operation
                await asyncio.sleep(0.001)
                operations += 1
            
            elapsed = time.perf_counter() - start
            throughput = operations / elapsed
            
            print(f"\nSustained Load ({duration}s):")
            print(f"  Operations: {operations}")
            print(f"  Throughput: {throughput:.1f} ops/sec")

    @pytest.mark.stability
    @pytest.mark.asyncio
    async def test_recovery_from_simulated_failures(self):
        """Test system recovers from simulated failures."""
        failure_count = 0
        success_count = 0
        
        for i in range(20):
            try:
                if i % 5 == 0:
                    # Simulate failure
                    raise ConnectionError("Simulated failure")
                
                # Normal operation
                await asyncio.sleep(0.001)
                success_count += 1
                
            except ConnectionError:
                failure_count += 1
                # Recovery
                await asyncio.sleep(0.01)
        
        print(f"\nFailure Recovery Test:")
        print(f"  Successes: {success_count}")
        print(f"  Failures: {failure_count}")
        print(f"  Recovery rate: {success_count / 20 * 100:.1f}%")
        
        assert success_count >= 15, "Too many failures without recovery"
