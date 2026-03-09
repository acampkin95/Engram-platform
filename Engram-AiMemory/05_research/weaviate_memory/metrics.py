# weaviate_memory/metrics.py
"""
Monitoring and observability for memory systems.
"""

import weaviate
from datetime import datetime
from typing import Optional
from .decay import MemoryDecay


class MemoryMetrics:
    """Track memory system health and performance."""
    
    def __init__(self, client: weaviate.WeaviateClient):
        """
        Initialize metrics collector.
        
        Args:
            client: Weaviate client
        """
        self.client = client
        self.decay = MemoryDecay(client)
    
    def collect_metrics(self) -> dict:
        """
        Gather comprehensive memory system metrics.
        
        Returns:
            Dict with metrics for all collections
        """
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "collections": {}
        }
        
        collection_names = [
            "EpisodicMemory",
            "SemanticMemory", 
            "ProceduralMemory",
            "WorkingMemory"
        ]
        
        for collection_name in collection_names:
            try:
                collection = self.client.collections.get(collection_name)
                
                count = 0
                importance_sum = 0
                recency_sum = 0
                access_sum = 0
                
                for obj in collection.iterator():
                    count += 1
                    importance_sum += obj.properties.get("importanceScore", 0)
                    recency_sum += obj.properties.get("recencyScore", 0)
                    access_sum += obj.properties.get("accessCount", 0)
                
                metrics["collections"][collection_name] = {
                    "object_count": count,
                    "avg_importance": round(importance_sum / count, 4) if count > 0 else 0,
                    "avg_recency": round(recency_sum / count, 4) if count > 0 else 0,
                    "avg_access_count": round(access_sum / count, 2) if count > 0 else 0,
                    "status": "healthy"
                }
            except Exception as e:
                metrics["collections"][collection_name] = {
                    "error": str(e),
                    "status": "error"
                }
        
        # Calculate totals
        total_objects = sum(
            m.get("object_count", 0) 
            for m in metrics["collections"].values()
            if "error" not in m
        )
        metrics["total_objects"] = total_objects
        
        return metrics
    
    def check_health(self) -> list[str]:
        """
        Check memory system health and identify issues.
        
        Returns:
            List of health status messages
        """
        metrics = self.collect_metrics()
        issues = []
        
        for name, data in metrics["collections"].items():
            if data.get("status") == "error":
                issues.append(f"ERROR: {name} - {data.get('error', 'Unknown error')}")
                continue
            
            count = data.get("object_count", 0)
            avg_importance = data.get("avg_importance", 0)
            avg_recency = data.get("avg_recency", 0)
            
            # Check for memory bloat
            if name == "EpisodicMemory" and count > 100000:
                issues.append(
                    f"WARNING: {name} has {count} objects - consider consolidation"
                )
            
            if name == "WorkingMemory" and count > 1000:
                issues.append(
                    f"WARNING: {name} has {count} objects - consider cleanup"
                )
            
            # Check for low importance (possible quality issues)
            if avg_importance < 0.3 and count > 100:
                issues.append(
                    f"WARNING: {name} average importance is low ({avg_importance:.2f})"
                )
            
            # Check for stale memories
            if avg_recency < 0.2 and count > 100:
                issues.append(
                    f"WARNING: {name} memories are stale (avg recency: {avg_recency:.2f})"
                )
        
        if not issues:
            issues.append("All systems healthy")
        
        return issues
    
    def get_collection_stats(
        self,
        collection_name: str
    ) -> dict:
        """
        Get detailed statistics for a specific collection.
        
        Args:
            collection_name: Name of collection
        
        Returns:
            Dict with detailed statistics
        """
        collection = self.client.collections.get(collection_name)
        
        stats = {
            "collection": collection_name,
            "timestamp": datetime.now().isoformat(),
            "total_count": 0,
            "importance_distribution": {
                "high": 0,     # > 0.7
                "medium": 0,   # 0.3 - 0.7
                "low": 0       # < 0.3
            },
            "recency_distribution": {
                "fresh": 0,    # > 0.7
                "aging": 0,    # 0.3 - 0.7
                "stale": 0     # < 0.3
            },
            "access_patterns": {
                "never_accessed": 0,
                "rarely_accessed": 0,  # 1-5
                "frequently_accessed": 0  # > 5
            }
        }
        
        for obj in collection.iterator():
            stats["total_count"] += 1
            
            importance = obj.properties.get("importanceScore", 0)
            if importance > 0.7:
                stats["importance_distribution"]["high"] += 1
            elif importance > 0.3:
                stats["importance_distribution"]["medium"] += 1
            else:
                stats["importance_distribution"]["low"] += 1
            
            recency = obj.properties.get("recencyScore", 0)
            if recency > 0.7:
                stats["recency_distribution"]["fresh"] += 1
            elif recency > 0.3:
                stats["recency_distribution"]["aging"] += 1
            else:
                stats["recency_distribution"]["stale"] += 1
            
            access = obj.properties.get("accessCount", 0)
            if access == 0:
                stats["access_patterns"]["never_accessed"] += 1
            elif access <= 5:
                stats["access_patterns"]["rarely_accessed"] += 1
            else:
                stats["access_patterns"]["frequently_accessed"] += 1
        
        return stats
    
    def get_decay_report(
        self,
        collection_name: str = "EpisodicMemory"
    ) -> dict:
        """
        Get detailed decay analysis report.
        
        Args:
            collection_name: Collection to analyze
        
        Returns:
            Dict with decay statistics
        """
        return self.decay.get_decay_statistics(collection_name)
    
    def generate_health_report(self) -> str:
        """
        Generate a formatted health report.
        
        Returns:
            Formatted report string
        """
        metrics = self.collect_metrics()
        health_issues = self.check_health()
        
        report = []
        report.append("=" * 50)
        report.append("MEMORY SYSTEM HEALTH REPORT")
        report.append(f"Generated: {metrics['timestamp']}")
        report.append("=" * 50)
        report.append("")
        
        report.append("COLLECTION SUMMARY:")
        report.append("-" * 30)
        for name, data in metrics["collections"].items():
            if data.get("status") == "error":
                report.append(f"  {name}: ERROR - {data.get('error')}")
            else:
                report.append(f"  {name}:")
                report.append(f"    Objects: {data.get('object_count', 0)}")
                report.append(f"    Avg Importance: {data.get('avg_importance', 0):.3f}")
                report.append(f"    Avg Recency: {data.get('avg_recency', 0):.3f}")
        
        report.append("")
        report.append(f"TOTAL OBJECTS: {metrics.get('total_objects', 0)}")
        report.append("")
        
        report.append("HEALTH STATUS:")
        report.append("-" * 30)
        for issue in health_issues:
            report.append(f"  • {issue}")
        
        report.append("")
        report.append("=" * 50)
        
        return "\n".join(report)
