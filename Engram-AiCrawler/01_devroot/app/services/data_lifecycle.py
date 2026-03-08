import os
import time
import signal
import logging
import shutil
import gzip
from pathlib import Path
from datetime import datetime, timedelta

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class DataLifecycleService:
    def __init__(self):
        self.running = True
        self.cleanup_interval = int(os.getenv("DATA_CLEANUP_INTERVAL_MINUTES", "5"))

        self.paths = {
            "hot": Path(os.getenv("DATA_HOT_PATH", "/app/data/tiers/hot")),
            "warm": Path(os.getenv("DATA_WARM_PATH", "/app/data/tiers/warm")),
            "cold": Path(os.getenv("DATA_COLD_PATH", "/app/data/tiers/cold")),
            "archive": Path(os.getenv("DATA_ARCHIVE_PATH", "/app/data/tiers/archive")),
        }

        self.age_limits = {
            "hot": timedelta(hours=int(os.getenv("DATA_HOT_MAX_AGE_HOURS", "24"))),
            "warm": timedelta(days=int(os.getenv("DATA_WARM_MAX_AGE_DAYS", "3"))),
            "cold": timedelta(days=int(os.getenv("DATA_COLD_MAX_AGE_DAYS", "7"))),
        }

        self.offload_threshold_days = int(os.getenv("DATA_OFFLOAD_THRESHOLD_DAYS", "3"))
        self.archive_threshold_gb = int(os.getenv("DATA_ARCHIVE_THRESHOLD_GB", "50"))

        signal.signal(signal.SIGTERM, self.handle_shutdown)
        signal.signal(signal.SIGINT, self.handle_shutdown)

        self.ensure_directories()

    def handle_shutdown(self, signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False

    def ensure_directories(self):
        for name, path in self.paths.items():
            path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Ensured directory exists: {path}")

    def get_file_age(self, filepath: Path) -> timedelta:
        return datetime.now() - datetime.fromtimestamp(filepath.stat().st_mtime)

    def get_directory_size(self, directory: Path) -> float:
        total = 0
        for item in directory.rglob("*"):
            if item.is_file():
                total += item.stat().st_size
        return total / (1024**3)

    def migrate_files(self, source_tier: str, target_tier: str):
        source_path = self.paths[source_tier]
        target_path = self.paths[target_tier]
        age_limit = self.age_limits[source_tier]

        if not source_path.exists():
            return

        migrated = 0
        for filepath in source_path.rglob("*"):
            if filepath.is_file():
                file_age = self.get_file_age(filepath)

                if file_age > age_limit:
                    relative_path = filepath.relative_to(source_path)
                    target_filepath = target_path / relative_path

                    target_filepath.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(filepath), str(target_filepath))

                    logger.debug(f"Migrated {relative_path} from {source_tier} to {target_tier}")
                    migrated += 1

        if migrated > 0:
            logger.info(f"Migrated {migrated} files from {source_tier} to {target_tier}")

    def archive_old_data(self):
        cold_path = self.paths["cold"]
        archive_path = self.paths["archive"]

        if not cold_path.exists():
            return

        archived = 0
        for filepath in cold_path.rglob("*"):
            if filepath.is_file() and not filepath.name.endswith(".gz"):
                relative_path = filepath.relative_to(cold_path)
                archive_filepath = archive_path / f"{relative_path}.gz"

                archive_filepath.parent.mkdir(parents=True, exist_ok=True)

                with open(filepath, "rb") as f_in:
                    with gzip.open(archive_filepath, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)

                filepath.unlink()
                archived += 1
                logger.debug(f"Archived and compressed: {relative_path}")

        if archived > 0:
            logger.info(f"Archived {archived} files (compressed with gzip)")

    def cleanup_old_archives(self):
        archive_path = self.paths["archive"]

        if not archive_path.exists():
            return

        removed = 0
        for filepath in archive_path.rglob("*"):
            if filepath.is_file():
                file_age = self.get_file_age(filepath)

                if file_age > timedelta(days=self.offload_threshold_days):
                    filepath.unlink()
                    logger.debug(f"Removed old archive: {filepath.name}")
                    removed += 1

        if removed > 0:
            logger.info(f"Removed {removed} old archives (> {self.offload_threshold_days} days)")

    def check_archive_threshold(self):
        archive_size_gb = self.get_directory_size(self.paths["archive"])

        if archive_size_gb >= self.archive_threshold_gb:
            logger.warning(
                f"Archive size {archive_size_gb:.2f}GB exceeds threshold {self.archive_threshold_gb}GB"
            )
            logger.warning("Offload or external backup recommended")
            return True
        return False

    def run_cycle(self):
        logger.info("Running data lifecycle cycle")

        try:
            self.migrate_files("hot", "warm")
            self.migrate_files("warm", "cold")
            self.migrate_files("cold", "archive")

            self.archive_old_data()
            self.cleanup_old_archives()

            archive_size_gb = self.get_directory_size(self.paths["archive"])
            logger.info(
                f"Archive size: {archive_size_gb:.2f}GB / {self.archive_threshold_gb}GB threshold"
            )

            self.check_archive_threshold()

        except Exception as e:
            logger.error(f"Error during cleanup cycle: {e}")

    def run(self):
        logger.info("Data lifecycle service started")
        logger.info(f"Configuration: cleanup_interval={self.cleanup_interval}min")
        logger.info(
            f"Age limits: hot={self.age_limits['hot']}, warm={self.age_limits['warm']}, cold={self.age_limits['cold']}"
        )

        while self.running:
            try:
                self.run_cycle()
            except Exception as e:
                logger.error(f"Error in cleanup cycle: {e}")

            time.sleep(self.cleanup_interval * 60)

        logger.info("Data lifecycle service stopped")


if __name__ == "__main__":
    service = DataLifecycleService()
    service.run()
