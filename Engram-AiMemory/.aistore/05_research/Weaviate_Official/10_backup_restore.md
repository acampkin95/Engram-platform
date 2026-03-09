# Weaviate Backup and Restore - Python v4 Client Guide

Comprehensive documentation for backup and restore functionality in the Weaviate Python v4 client. This guide covers all backup backends, creation, restoration, status checking, partial backups, and scheduling patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Backends](#backup-backends)
3. [Creating Backups](#creating-backups)
4. [Restoring Backups](#restoring-backups)
5. [Status Checking](#status-checking)
6. [Partial Backups](#partial-backups)
7. [Backup Scheduling Patterns](#backup-scheduling-patterns)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Complete Workflow Examples](#complete-workflow-examples)

---

## Overview

Weaviate's backup and restore functionality allows you to:

- Create full or partial backups of your data
- Restore backups to recover from failures
- Target specific collections during backup/restore operations
- Check the status of ongoing backup/restore jobs
- Use multiple storage backends for redundancy and flexibility

The backup system in the Python v4 client is accessed through `client.backup` for full backups and through `collection.backup` for collection-specific operations.

---

## Backup Backends

Weaviate supports multiple backup storage backends. Each requires specific configuration and authentication.

### 1. Filesystem Backend

**Use Case**: Development, testing, and local deployments.

**Requirements**:
- Local disk space
- Write access to the designated backup directory
- No additional authentication needed

**Docker Configuration Example**:
```dockerfile
# Set backup path as environment variable
BACKUP_FILESYSTEM_PATH=/tmp/backups

# Mount volume for persistence
volumes:
  - ./backups:/tmp/backups
```

**Python Usage**:
```python
import weaviate

client = weaviate.connect_to_local()

# Create filesystem backup
backup_result = client.backup.create(
    backup_id="local-backup-001",
    backend="filesystem",
    wait_for_completion=True
)
```

**Advantages**:
- No cloud account required
- Fastest for local backups
- Simple configuration

**Disadvantages**:
- Requires local storage space
- Not suitable for cross-region redundancy
- Limited scalability

---

### 2. AWS S3 Backend

**Use Case**: Production environments, multi-region backups, cloud-native deployments.

**Requirements**:
- AWS S3 bucket
- IAM credentials with S3 access
- `backup-s3` module enabled in Weaviate

**Weaviate Configuration**:
```bash
# Environment variables
ENABLE_MODULES=backup-s3
BACKUP_S3_BUCKET=my-weaviate-backups
BACKUP_S3_PATH=/backups  # Optional path prefix
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

**Docker Compose Example**:
```yaml
version: '3.8'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      ENABLE_MODULES: "backup-s3"
      BACKUP_S3_BUCKET: "my-weaviate-backups"
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
      AWS_REGION: "us-east-1"
    ports:
      - "8080:8080"
```

**Python Usage**:
```python
import weaviate
import os

client = weaviate.connect_to_local()

# Create S3 backup
backup_result = client.backup.create(
    backup_id="s3-backup-prod-001",
    backend="s3",
    wait_for_completion=True
)

print(f"Backup ID: {backup_result.backup_id}")
print(f"Status: {backup_result.status}")
```

**Advantages**:
- Enterprise-grade durability (11 9's)
- Multi-region replication available
- Cost-effective for large backups
- Integrates with AWS ecosystem

**Considerations**:
- Network latency for backup/restore
- Requires AWS account and credentials
- Cross-region transfer costs

---

### 3. Google Cloud Storage (GCS) Backend

**Use Case**: GCP-native deployments, organizations using Google Cloud.

**Requirements**:
- GCS bucket
- Service account with GCS permissions
- `backup-gcs` module enabled in Weaviate
- Application Default Credentials (ADC) or service account key

**Weaviate Configuration**:
```bash
# Environment variables
ENABLE_MODULES=backup-gcs
BACKUP_GCS_BUCKET=my-weaviate-backups
BACKUP_GCS_PATH=/backups  # Optional path prefix
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Docker Compose Example**:
```yaml
version: '3.8'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      ENABLE_MODULES: "backup-gcs"
      BACKUP_GCS_BUCKET: "my-weaviate-backups"
      GOOGLE_APPLICATION_CREDENTIALS: "/etc/gcp/service-account-key.json"
    volumes:
      - ./gcp-credentials.json:/etc/gcp/service-account-key.json:ro
    ports:
      - "8080:8080"
```

**Python Usage**:
```python
import weaviate
import os

client = weaviate.connect_to_local()

# Create GCS backup
backup_result = client.backup.create(
    backup_id="gcs-backup-prod-001",
    backend="gcs",
    wait_for_completion=True
)
```

**Authentication Methods**:

1. **Application Default Credentials (ADC)**:
```bash
# Automatically discover credentials from environment
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

2. **Service Account Key**:
```bash
# Pass through Docker volume mount or environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json
```

3. **GCP CLI Integration**:
```bash
# Use local gcloud CLI authentication
gcloud auth application-default login
```

**Advantages**:
- Native integration with GCP services
- Flexible authentication options
- Good performance in GCP regions

**Considerations**:
- Requires GCP account
- Service account key management required
- Network latency for non-GCP regions

---

### 4. Azure Blob Storage Backend

**Use Case**: Azure-native deployments, Microsoft ecosystem integration.

**Requirements**:
- Azure Storage Account
- Container in Blob Storage
- Storage account key or connection string
- `backup-azure` module enabled in Weaviate

**Weaviate Configuration**:
```bash
# Environment variables
ENABLE_MODULES=backup-azure
BACKUP_AZURE_CONTAINER=weaviate-backups
BACKUP_AZURE_PATH=/backups  # Optional path prefix
AZURE_STORAGE_ACCOUNT_NAME=mystorageaccount
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
```

**Docker Compose Example**:
```yaml
version: '3.8'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      ENABLE_MODULES: "backup-azure"
      BACKUP_AZURE_CONTAINER: "weaviate-backups"
      AZURE_STORAGE_ACCOUNT_NAME: "${AZURE_STORAGE_ACCOUNT_NAME}"
      AZURE_STORAGE_ACCOUNT_KEY: "${AZURE_STORAGE_ACCOUNT_KEY}"
    ports:
      - "8080:8080"
```

**Python Usage**:
```python
import weaviate

client = weaviate.connect_to_local()

# Create Azure backup
backup_result = client.backup.create(
    backup_id="azure-backup-prod-001",
    backend="azure",
    wait_for_completion=True
)
```

**Advantages**:
- Enterprise-grade Azure integration
- Part of Azure ecosystem
- Geographic redundancy options

**Considerations**:
- Requires Azure subscription
- Storage account management needed
- Access control through Azure IAM

---

## Creating Backups

### Basic Backup Creation

Create a full backup of all collections using the `client.backup.create()` method.

```python
import weaviate

# Connect to Weaviate
with weaviate.connect_to_local() as client:
    # Create a full backup
    result = client.backup.create(
        backup_id="full-backup-2024-01-30",
        backend="filesystem",
        wait_for_completion=True
    )

    print(f"Backup ID: {result.backup_id}")
    print(f"Status: {result.status}")
    print(f"Path: {result.path}")
```

### Asynchronous Backup Creation

Create backups without blocking execution:

```python
import weaviate
import time

with weaviate.connect_to_local() as client:
    # Start backup without waiting
    result = client.backup.create(
        backup_id="async-backup-001",
        backend="s3",
        wait_for_completion=False
    )

    print(f"Backup started: {result.backup_id}")
    print(f"Initial status: {result.status}")

    # Poll status in background
    while True:
        status = client.backup.get_create_status(
            backup_id="async-backup-001",
            backend="s3"
        )

        if status["status"] == "SUCCESS":
            print("Backup completed successfully!")
            break
        elif status["status"] == "FAILED":
            print(f"Backup failed: {status['error']}")
            break

        print(f"Backup status: {status['status']}")
        time.sleep(5)
```

### Backup with Custom Parameters

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Backup with extended timeout
    result = client.backup.create(
        backup_id="custom-backup-001",
        backend="gcs",
        wait_for_completion=True,
        # Additional parameters depend on backend
    )

    return result
```

### Create Backup Return Object

The `create()` method returns a backup result object with the following properties:

```python
result = client.backup.create(...)

# Properties
result.backup_id          # str: The backup identifier
result.path              # str: Path/location of backup
result.status            # str: Current status (STARTED, IN_PROGRESS, SUCCESS, FAILED)
result.collections       # dict: Collection-specific status information
result.error             # str: Error message (if status is FAILED)
result.started_at        # datetime: When backup started
result.completed_at      # datetime: When backup completed
```

---

## Restoring Backups

### Basic Backup Restoration

Restore a complete backup from a specified backend:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Restore full backup
    result = client.backup.restore(
        backup_id="full-backup-2024-01-30",
        backend="filesystem",
        wait_for_completion=True
    )

    print(f"Restore completed: {result.status}")
    print(f"Collections restored: {result.collections}")
```

### Asynchronous Restoration

Restore backups without blocking:

```python
import weaviate
import time

with weaviate.connect_to_local() as client:
    # Start restore without waiting
    result = client.backup.restore(
        backup_id="large-backup-001",
        backend="s3",
        wait_for_completion=False
    )

    print(f"Restore started: {result.backup_id}")

    # Monitor restoration progress
    while True:
        status = client.backup.get_restore_status(
            backup_id="large-backup-001",
            backend="s3"
        )

        if status["status"] == "SUCCESS":
            print("Restore completed!")
            break

        print(f"Restore status: {status['status']}")
        time.sleep(10)
```

### Restore with Collection Filtering

Restore only specific collections from a backup:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Restore only Article and Author collections
    result = client.backup.restore(
        backup_id="multi-collection-backup",
        backend="filesystem",
        include_collections=["Article", "Author"],
        wait_for_completion=True
    )

    print(f"Restored collections: {result.collections}")
```

### Restore with Exclusion

Restore all collections except specified ones:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Restore everything except the Temp collection
    result = client.backup.restore(
        backup_id="backup-001",
        backend="gcs",
        exclude_collections=["Temp", "Archive"],
        wait_for_completion=True
    )
```

### Important Restoration Constraints

**Critical**: A restore operation fails if any of the target collections already exist in the Weaviate instance.

**Pre-Restoration Checklist**:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # List existing collections
    existing = client.collections.list_all()
    existing_names = [col.name for col in existing.collections]

    print(f"Existing collections: {existing_names}")

    # Verify no conflicts with backup collections
    backup_collections = ["Article", "Author", "Publication"]

    conflicts = set(existing_names) & set(backup_collections)
    if conflicts:
        print(f"ERROR: Cannot restore. Conflicting collections: {conflicts}")

        # Option 1: Delete conflicting collections
        for collection in conflicts:
            client.collections.delete(collection)
            print(f"Deleted collection: {collection}")

        # Option 2: Use exclude_collections to skip them
        # result = client.backup.restore(
        #     backup_id="backup-001",
        #     backend="filesystem",
        #     exclude_collections=list(conflicts),
        #     wait_for_completion=True
        # )
```

### Restore Return Object

```python
result = client.backup.restore(...)

# Properties
result.backup_id          # str: The backup identifier
result.status             # str: Current status
result.collections        # dict: Collection-specific status
result.error              # str: Error message (if failed)
result.started_at         # datetime: When restore started
result.completed_at       # datetime: When restore completed
```

---

## Status Checking

### Get Backup Creation Status

Check the status of an ongoing or completed backup creation:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Check backup creation status
    status = client.backup.get_create_status(
        backup_id="async-backup-001",
        backend="filesystem"
    )

    print(f"Status: {status['status']}")
    print(f"Error: {status.get('error', 'None')}")

    # Status values: STARTED, IN_PROGRESS, SUCCESS, FAILED
    if status['status'] == 'SUCCESS':
        print("Backup completed successfully!")
    elif status['status'] == 'FAILED':
        print(f"Backup failed: {status['error']}")
```

### Get Restore Status

Check the status of an ongoing or completed backup restore:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Check restore status
    status = client.backup.get_restore_status(
        backup_id="restore-job-001",
        backend="s3"
    )

    print(f"Status: {status['status']}")
    print(f"Started at: {status.get('started_at')}")
    print(f"Completed at: {status.get('completed_at')}")
```

### Status Polling Pattern

Implement robust status polling with exponential backoff:

```python
import weaviate
import time
from typing import Dict, Literal

def poll_backup_status(
    client: weaviate.WeaviateClient,
    backup_id: str,
    backend: str,
    timeout_seconds: int = 3600,
    initial_delay: int = 5
) -> Dict:
    """Poll backup status until completion or timeout."""

    start_time = time.time()
    delay = initial_delay

    while True:
        elapsed = time.time() - start_time

        if elapsed > timeout_seconds:
            raise TimeoutError(f"Backup {backup_id} did not complete within {timeout_seconds}s")

        try:
            status = client.backup.get_create_status(
                backup_id=backup_id,
                backend=backend
            )

            print(f"[{elapsed:.0f}s] Status: {status['status']}")

            if status['status'] in ['SUCCESS', 'FAILED']:
                return status

            # Exponential backoff with max delay of 30s
            time.sleep(min(delay, 30))
            delay *= 1.5

        except Exception as e:
            print(f"Error checking status: {e}")
            time.sleep(delay)
            delay *= 1.5


# Usage
with weaviate.connect_to_local() as client:
    # Start backup
    result = client.backup.create(
        backup_id="monitored-backup",
        backend="filesystem",
        wait_for_completion=False
    )

    # Poll until completion
    final_status = poll_backup_status(
        client=client,
        backup_id="monitored-backup",
        backend="filesystem",
        timeout_seconds=1800  # 30 minutes
    )

    if final_status['status'] == 'SUCCESS':
        print("Backup successful!")
    else:
        print(f"Backup failed: {final_status.get('error')}")
```

---

## Partial Backups

### Backup Specific Collections

Backup only specified collections to reduce backup size and time:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Backup only Article collection
    result = client.backup.create(
        backup_id="article-backup-001",
        backend="filesystem",
        include_collections="Article",  # Single collection as string
        wait_for_completion=True
    )

    print(f"Backup completed: {result.status}")
    print(f"Collections: {result.collections}")
```

### Backup Multiple Specific Collections

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Backup multiple collections
    result = client.backup.create(
        backup_id="content-backup-001",
        backend="s3",
        include_collections=["Article", "Author", "Publication"],
        wait_for_completion=True
    )
```

### Exclude Collections from Backup

Backup everything except specified collections:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Backup all except Temp collections
    result = client.backup.create(
        backup_id="prod-backup-001",
        backend="gcs",
        exclude_collections=["TempCache", "SessionData"],
        wait_for_completion=True
    )
```

### Collection-Specific Status

Check status of individual collections in a backup:

```python
import weaviate

with weaviate.connect_to_local() as client:
    status = client.backup.get_create_status(
        backup_id="partial-backup-001",
        backend="filesystem"
    )

    # Get status per collection
    for collection_name, collection_status in status.get('collections', {}).items():
        print(f"{collection_name}: {collection_status['status']}")
        print(f"  Objects: {collection_status.get('objects_count')}")
        print(f"  Error: {collection_status.get('error', 'None')}")
```

### Dynamic Collection Selection

Backup collections based on criteria:

```python
import weaviate

with weaviate.connect_to_local() as client:
    # Get all collections
    all_collections = client.collections.list_all()

    # Filter by criteria
    # Example: Only backup collections with "prod" in the name
    prod_collections = [
        col.name for col in all_collections.collections
        if 'prod' in col.name.lower()
    ]

    print(f"Backing up: {prod_collections}")

    # Create backup with filtered collections
    result = client.backup.create(
        backup_id="prod-only-backup",
        backend="filesystem",
        include_collections=prod_collections,
        wait_for_completion=True
    )
```

### Incremental Backup Pattern

Implement incremental-style backups by excluding already-backed-up collections:

```python
import weaviate
from datetime import datetime

class BackupManager:
    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.backed_up = set()

    def incremental_backup(self, backend: str):
        """Backup only new collections."""

        # Get current collections
        all_cols = self.client.collections.list_all()
        current = {col.name for col in all_cols.collections}

        # Find new collections
        new_collections = current - self.backed_up

        if new_collections:
            backup_id = f"incremental-{datetime.now().isoformat()}"

            result = self.client.backup.create(
                backup_id=backup_id,
                backend=backend,
                include_collections=list(new_collections),
                wait_for_completion=True
            )

            self.backed_up.update(new_collections)
            print(f"Incremental backup created: {backup_id}")
            print(f"New collections: {new_collections}")
        else:
            print("No new collections to backup")


# Usage
with weaviate.connect_to_local() as client:
    manager = BackupManager(client)
    manager.incremental_backup("filesystem")
```

---

## Backup Scheduling Patterns

### Simple Scheduled Backups with APScheduler

```python
import weaviate
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ScheduledBackupManager:
    def __init__(self, host: str = "localhost", port: int = 8080):
        self.client = weaviate.connect_to_local(host=host, port=port)
        self.scheduler = BackgroundScheduler()

    def backup_job(self, backup_type: str = "full"):
        """Execute a backup job."""

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_id = f"{backup_type}-{timestamp}"

            logger.info(f"Starting {backup_type} backup: {backup_id}")

            result = self.client.backup.create(
                backup_id=backup_id,
                backend="filesystem",
                wait_for_completion=True
            )

            if result.status == "SUCCESS":
                logger.info(f"Backup {backup_id} completed successfully")
            else:
                logger.error(f"Backup {backup_id} failed: {result.error}")

        except Exception as e:
            logger.error(f"Backup job error: {str(e)}")

    def start(self):
        """Start the backup scheduler."""

        # Daily full backup at 2 AM
        self.scheduler.add_job(
            func=self.backup_job,
            trigger="cron",
            hour=2,
            minute=0,
            kwargs={"backup_type": "daily"},
            id="daily-backup"
        )

        # Hourly incremental backup
        self.scheduler.add_job(
            func=self.backup_job,
            trigger="cron",
            minute=0,
            kwargs={"backup_type": "hourly"},
            id="hourly-backup"
        )

        self.scheduler.start()
        logger.info("Backup scheduler started")

    def stop(self):
        """Stop the backup scheduler."""
        self.scheduler.shutdown()
        self.client.close()


# Usage
if __name__ == "__main__":
    manager = ScheduledBackupManager()
    manager.start()

    try:
        # Keep running
        while True:
            pass
    except KeyboardInterrupt:
        manager.stop()
```

### Cron-Based Backup Script

Create a cron job that executes backups:

```bash
#!/bin/bash
# backup.sh - Execute Weaviate backup

BACKUP_SCRIPT="/opt/weaviate/backup.py"
LOG_FILE="/var/log/weaviate-backup.log"

python3 "$BACKUP_SCRIPT" >> "$LOG_FILE" 2>&1
```

Python script:
```python
#!/usr/bin/env python3
import weaviate
from datetime import datetime
import sys

def create_backup():
    try:
        client = weaviate.connect_to_local()

        backup_id = f"cron-backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        print(f"[{datetime.now()}] Starting backup: {backup_id}")

        result = client.backup.create(
            backup_id=backup_id,
            backend="s3",
            wait_for_completion=True
        )

        if result.status == "SUCCESS":
            print(f"[{datetime.now()}] Backup {backup_id} completed")
            client.close()
            return 0
        else:
            print(f"[{datetime.now()}] Backup failed: {result.error}")
            client.close()
            return 1

    except Exception as e:
        print(f"[{datetime.now()}] Error: {str(e)}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(create_backup())
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup.sh

# Backup every 6 hours
0 */6 * * * /usr/local/bin/backup.sh
```

### Kubernetes CronJob

Deploy scheduled backups in Kubernetes:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: weaviate-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: python:3.11-slim
            command:
            - /bin/sh
            - -c
            - |
              pip install weaviate-client &&
              python /scripts/backup.py
            volumeMounts:
            - name: backup-script
              mountPath: /scripts
            env:
            - name: WEAVIATE_HOST
              value: weaviate
            - name: WEAVIATE_PORT
              value: "8080"
          volumes:
          - name: backup-script
            configMap:
              name: backup-script
          restartPolicy: OnFailure
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: backup-script
data:
  backup.py: |
    import weaviate
    import os
    from datetime import datetime

    client = weaviate.connect_to_local(
        host=os.getenv("WEAVIATE_HOST", "localhost"),
        port=int(os.getenv("WEAVIATE_PORT", "8080"))
    )

    backup_id = f"k8s-backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    result = client.backup.create(
        backup_id=backup_id,
        backend="s3",
        wait_for_completion=True
    )

    print(f"Backup {backup_id}: {result.status}")
    client.close()
```

### Backup Rotation Policy

Implement backup retention and rotation:

```python
import weaviate
import boto3
from datetime import datetime, timedelta
from typing import List

class BackupRotationManager:
    def __init__(
        self,
        weaviate_host: str = "localhost",
        s3_bucket: str = None,
        retention_days: int = 30
    ):
        self.client = weaviate.connect_to_local(host=weaviate_host)
        self.s3_client = boto3.client('s3') if s3_bucket else None
        self.s3_bucket = s3_bucket
        self.retention_days = retention_days

    def create_backup(self) -> str:
        """Create a new backup."""

        backup_id = f"backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        result = self.client.backup.create(
            backup_id=backup_id,
            backend="s3",
            wait_for_completion=True
        )

        if result.status == "SUCCESS":
            print(f"Backup created: {backup_id}")
            return backup_id
        else:
            raise Exception(f"Backup failed: {result.error}")

    def cleanup_old_backups(self):
        """Delete backups older than retention period."""

        if not self.s3_client:
            print("S3 not configured")
            return

        cutoff_date = datetime.now() - timedelta(days=self.retention_days)

        # List backups
        response = self.s3_client.list_objects_v2(
            Bucket=self.s3_bucket,
            Prefix="backups/"
        )

        deleted_count = 0
        for obj in response.get('Contents', []):
            if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                self.s3_client.delete_object(
                    Bucket=self.s3_bucket,
                    Key=obj['Key']
                )
                deleted_count += 1
                print(f"Deleted old backup: {obj['Key']}")

        print(f"Total backups deleted: {deleted_count}")

    def run_backup_cycle(self):
        """Execute full backup cycle with cleanup."""

        try:
            # Create new backup
            backup_id = self.create_backup()

            # Cleanup old backups
            self.cleanup_old_backups()

            print("Backup cycle completed successfully")

        except Exception as e:
            print(f"Backup cycle failed: {str(e)}")

        finally:
            self.client.close()


# Usage
if __name__ == "__main__":
    manager = BackupRotationManager(
        retention_days=30
    )
    manager.run_backup_cycle()
```

---

## Error Handling

### Common Errors and Solutions

#### Error: Collection Already Exists

```python
import weaviate

with weaviate.connect_to_local() as client:
    try:
        result = client.backup.restore(
            backup_id="backup-001",
            backend="filesystem",
            wait_for_completion=True
        )
    except Exception as e:
        if "already exists" in str(e):
            print("Collections already exist. Deleting...")

            # Delete conflicting collections
            client.collections.delete("Article")
            client.collections.delete("Author")

            # Retry restore
            result = client.backup.restore(
                backup_id="backup-001",
                backend="filesystem",
                wait_for_completion=True
            )
```

#### Error: Backend Not Configured

```python
import weaviate

with weaviate.connect_to_local() as client:
    try:
        result = client.backup.create(
            backup_id="backup-001",
            backend="s3",
            wait_for_completion=True
        )
    except Exception as e:
        if "not enabled" in str(e) or "not configured" in str(e):
            print("ERROR: S3 backend not configured")
            print("Solution: Set ENABLE_MODULES=backup-s3 and configure AWS credentials")
```

#### Error: Insufficient Disk Space

```python
import weaviate
import os

with weaviate.connect_to_local() as client:
    # Check available space before backup
    stat = os.statvfs("/tmp/backups")
    available_gb = stat.f_bavail * stat.f_frsize / (1024**3)

    if available_gb < 10:  # Less than 10 GB
        print(f"WARNING: Only {available_gb:.2f} GB available")
        print("Backup may fail due to insufficient space")
```

### Comprehensive Error Handler

```python
import weaviate
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

class BackupErrorHandler:
    """Handle backup-related errors gracefully."""

    @staticmethod
    def create_with_retry(
        client: weaviate.WeaviateClient,
        backup_id: str,
        backend: str,
        max_retries: int = 3,
        retry_delay: int = 5
    ) -> Optional[Dict]:
        """Create backup with automatic retry."""

        import time

        for attempt in range(max_retries):
            try:
                logger.info(f"Backup attempt {attempt + 1}/{max_retries}: {backup_id}")

                result = client.backup.create(
                    backup_id=backup_id,
                    backend=backend,
                    wait_for_completion=True
                )

                if result.status == "SUCCESS":
                    logger.info(f"Backup successful: {backup_id}")
                    return result
                else:
                    logger.error(f"Backup failed: {result.error}")

            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")

                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)

        logger.error(f"Backup failed after {max_retries} attempts")
        return None


# Usage
with weaviate.connect_to_local() as client:
    result = BackupErrorHandler.create_with_retry(
        client=client,
        backup_id="resilient-backup",
        backend="s3",
        max_retries=3
    )
```

---

## Best Practices

### 1. Regular Backup Schedule

- **Daily full backups**: For production systems
- **Hourly incremental backups**: For high-value data
- **Weekly archive backups**: For long-term retention

```python
# Recommended schedule
BACKUP_SCHEDULE = {
    "hourly": "0 * * * *",        # Every hour
    "daily": "0 2 * * *",          # 2 AM daily
    "weekly": "0 3 * * 0",         # 3 AM Sundays
}
```

### 2. Test Restore Regularly

Never rely on untested backups:

```python
import weaviate
from datetime import datetime

def test_backup_integrity():
    """Periodically test backup restoration."""

    with weaviate.connect_to_local() as client:
        # Create test backup
        backup_id = f"test-backup-{datetime.now().isoformat()}"

        result = client.backup.create(
            backup_id=backup_id,
            backend="filesystem",
            wait_for_completion=True
        )

        if result.status != "SUCCESS":
            print(f"Backup test failed: {result.error}")
            return False

        # For restore testing, use a separate instance
        # to avoid conflicts with existing collections
        print("Backup test passed")
        return True
```

### 3. Use Appropriate Backends

| Environment | Recommended Backend |
|-------------|-------------------|
| Development | Filesystem |
| Staging | S3 or GCS |
| Production | S3, GCS, or Azure (with replication) |

### 4. Monitor Backup Performance

```python
import weaviate
from datetime import datetime

def monitor_backup_performance(client, backup_id, backend):
    """Track backup performance metrics."""

    start = datetime.now()

    result = client.backup.create(
        backup_id=backup_id,
        backend=backend,
        wait_for_completion=True
    )

    duration = (datetime.now() - start).total_seconds()

    print(f"Backup Duration: {duration:.2f} seconds")
    print(f"Status: {result.status}")
    print(f"Collections: {len(result.collections)}")
```

### 5. Secure Backup Storage

- Use encryption at rest for S3/GCS/Azure
- Restrict IAM/access control permissions
- Regularly audit backup access logs
- Store credentials in secure vaults (not hardcoded)

```python
# Good: Use environment variables
import os

client = weaviate.connect_to_local(
    host=os.getenv("WEAVIATE_HOST"),
    port=int(os.getenv("WEAVIATE_PORT", "8080"))
)

# Good: Use secrets management
from dotenv import load_dotenv
load_dotenv()

# Bad: Hardcoded credentials
# backup_s3_bucket = "my-bucket"  # Don't do this
```

### 6. Document Your Backup Strategy

Create a backup and recovery runbook:

```markdown
# Weaviate Backup & Recovery Runbook

## Backup Schedule
- Daily full backups: 2 AM UTC
- Hourly incremental: Every hour
- Retention: 30 days

## Restore Procedure
1. Identify backup ID from logs
2. List existing collections
3. Delete conflicting collections if needed
4. Execute restore with appropriate parameters
5. Verify data integrity
6. Monitor restore status

## Contact Information
- On-call: [Team Name]
- Slack channel: #weaviate-ops
```

---

## Complete Workflow Examples

### Example 1: Daily Backup with Verification

```python
import weaviate
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def daily_backup_workflow():
    """Execute complete daily backup workflow."""

    with weaviate.connect_to_local() as client:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_id = f"daily-{timestamp}"

        try:
            # Step 1: Pre-backup validation
            logger.info("Validating Weaviate connection...")
            collections = client.collections.list_all()
            logger.info(f"Found {len(collections.collections)} collections")

            # Step 2: Create backup
            logger.info(f"Starting backup: {backup_id}")
            result = client.backup.create(
                backup_id=backup_id,
                backend="s3",
                wait_for_completion=True
            )

            if result.status != "SUCCESS":
                logger.error(f"Backup failed: {result.error}")
                return False

            logger.info(f"Backup completed: {result.path}")

            # Step 3: Verify backup
            status = client.backup.get_create_status(
                backup_id=backup_id,
                backend="s3"
            )

            logger.info(f"Final status: {status['status']}")
            logger.info(f"Collections backed up: {len(result.collections)}")

            return True

        except Exception as e:
            logger.error(f"Backup workflow failed: {str(e)}")
            return False


# Execute
if __name__ == "__main__":
    success = daily_backup_workflow()
    exit(0 if success else 1)
```

### Example 2: Selective Restore with Validation

```python
import weaviate
from typing import List

def selective_restore_workflow(
    backup_id: str,
    collections_to_restore: List[str]
):
    """Restore specific collections with validation."""

    with weaviate.connect_to_local() as client:
        print(f"Starting restore: {backup_id}")
        print(f"Target collections: {collections_to_restore}")

        # Step 1: Check existing collections
        existing = client.collections.list_all()
        existing_names = [col.name for col in existing.collections]

        # Step 2: Identify conflicts
        conflicts = set(collections_to_restore) & set(existing_names)

        if conflicts:
            print(f"Conflict detected: {conflicts}")
            print("Deleting conflicting collections...")

            for col in conflicts:
                client.collections.delete(col)
                print(f"  Deleted: {col}")

        # Step 3: Perform restore
        print("Performing restore...")
        result = client.backup.restore(
            backup_id=backup_id,
            backend="filesystem",
            include_collections=collections_to_restore,
            wait_for_completion=True
        )

        # Step 4: Validate restoration
        if result.status == "SUCCESS":
            print("Restore completed successfully")

            # Verify all collections restored
            restored = client.collections.list_all()
            restored_names = {col.name for col in restored.collections}

            for col in collections_to_restore:
                if col in restored_names:
                    print(f"  ✓ {col}")
                else:
                    print(f"  ✗ {col} - MISSING!")
        else:
            print(f"Restore failed: {result.error}")


# Execute
selective_restore_workflow(
    backup_id="multi-collection-backup",
    collections_to_restore=["Article", "Author"]
)
```

### Example 3: Backup Migration Between Backends

```python
import weaviate
from datetime import datetime

def migrate_backup_backend(
    source_backend: str,
    source_backup_id: str,
    target_backend: str,
):
    """Migrate backup from one backend to another."""

    with weaviate.connect_to_local() as client:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_backup_id = f"temp-restore-{timestamp}"
        new_backup_id = f"{source_backup_id}-{target_backend}-{timestamp}"

        try:
            # Step 1: Restore from source backend
            print(f"Restoring from {source_backend}...")
            restore_result = client.backup.restore(
                backup_id=source_backup_id,
                backend=source_backend,
                wait_for_completion=True
            )

            if restore_result.status != "SUCCESS":
                print(f"Restore failed: {restore_result.error}")
                return False

            # Step 2: Create backup to target backend
            print(f"Creating backup to {target_backend}...")
            backup_result = client.backup.create(
                backup_id=new_backup_id,
                backend=target_backend,
                wait_for_completion=True
            )

            if backup_result.status != "SUCCESS":
                print(f"Backup failed: {backup_result.error}")
                return False

            print(f"Migration successful!")
            print(f"New backup ID: {new_backup_id}")
            return True

        except Exception as e:
            print(f"Migration failed: {str(e)}")
            return False


# Execute
migrate_backup_backend(
    source_backend="filesystem",
    source_backup_id="local-backup-001",
    target_backend="s3"
)
```

---

## References

- [Weaviate Backups Documentation](https://weaviate.io/developers/weaviate/configuration/backups)
- [Weaviate Python Client API](https://weaviate-python-client.readthedocs.io/)
- [Tutorial: Backup and Restore in Weaviate](https://weaviate.io/blog/tutorial-backup-and-restore-in-weaviate)
- [Weaviate GitHub Repository](https://github.com/weaviate/weaviate-python-client)
- [APScheduler Documentation](https://apscheduler.readthedocs.io/)

---

## Summary

This guide covers the complete backup and restore workflow for Weaviate's Python v4 client:

- **Backends**: Filesystem, S3, GCS, and Azure storage options
- **Creating Backups**: Full and partial backup creation with async/sync patterns
- **Restoring Backups**: Complete and selective restoration with conflict handling
- **Status Checking**: Polling patterns and status monitoring
- **Partial Backups**: Collection-level backup and restore operations
- **Scheduling**: APScheduler, cron, and Kubernetes CronJob patterns
- **Error Handling**: Common issues and recovery strategies
- **Best Practices**: Production-ready patterns and security considerations

Use this documentation as a reference when implementing backup strategies for your Weaviate deployment.
