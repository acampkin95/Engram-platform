import os
import time
import signal
import logging
from datetime import datetime, timedelta


try:
    import psutil
except ImportError:
    psutil = None

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class WatchdogService:
    def __init__(self):
        self.running = True
        self.check_interval = int(os.getenv("WATCHDOG_CHECK_INTERVAL_SECONDS", "30"))
        self.orphan_age_minutes = int(os.getenv("WATCHDOG_ORPHAN_AGE_MINUTES", "60"))
        self.memory_threshold = int(os.getenv("WATCHDOG_MEMORY_THRESHOLD_PERCENT", "90"))
        self.disk_threshold = int(os.getenv("WATCHDOG_DISK_THRESHOLD_PERCENT", "85"))
        self.memory_check_enabled = (
            os.getenv("WATCHDOG_MEMORY_CHECK_ENABLED", "true").lower() == "true"
        )
        self.disk_check_enabled = os.getenv("WATCHDOG_DISK_CHECK_ENABLED", "true").lower() == "true"

        signal.signal(signal.SIGTERM, self.handle_shutdown)
        signal.signal(signal.SIGINT, self.handle_shutdown)

    def handle_shutdown(self, signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False

    def check_orphaned_workers(self):
        try:
            import psutil

            current_time = datetime.now()

            for proc in psutil.process_iter(["pid", "name", "create_time", "cmdline"]):
                try:
                    proc_info = proc.info
                    if proc_info["name"] and "playwright" in proc_info["name"].lower():
                        create_time = datetime.fromtimestamp(proc_info["create_time"])
                        age = current_time - create_time

                        if age > timedelta(minutes=self.orphan_age_minutes):
                            logger.warning(
                                f"Found orphaned worker (PID: {proc_info['pid']}, age: {age})"
                            )
                            proc.kill()
                            logger.info(f"Killed orphaned worker PID {proc_info['pid']}")
                except (
                    psutil.NoSuchProcess,
                    psutil.AccessDenied,
                    psutil.ZombieProcess,
                ):
                    continue
        except ImportError:
            logger.warning("psutil not available, skipping worker check")
        except Exception as e:
            logger.error(f"Error checking orphaned workers: {e}")

    def check_memory_usage(self):
        if not self.memory_check_enabled:
            return

        try:
            import psutil

            memory = psutil.virtual_memory()

            if memory.percent >= self.memory_threshold:
                logger.warning(
                    f"Memory usage at {memory.percent}% (threshold: {self.memory_threshold}%)"
                )

                for proc in sorted(
                    psutil.process_iter(["pid", "name", "memory_percent"]),
                    key=lambda p: p.info["memory_percent"] or 0,
                    reverse=True,
                ):
                    try:
                        proc_info = proc.info
                        if proc_info["name"] and "playwright" in proc_info["name"].lower():
                            logger.info(
                                f"Terminating high-memory worker (PID: {proc_info['pid']}, memory: {proc_info['memory_percent']}%)"
                            )
                            proc.terminate()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
        except Exception as e:
            logger.error(f"Error checking memory: {e}")

    def check_disk_usage(self):
        if not self.disk_check_enabled:
            return

        try:
            import shutil

            disk_usage = shutil.disk_usage("/app")
            percent_used = (disk_usage.used / disk_usage.total) * 100

            if percent_used >= self.disk_threshold:
                logger.warning(
                    f"Disk usage at {percent_used:.1f}% (threshold: {self.disk_threshold}%)"
                )
        except Exception as e:
            logger.error(f"Error checking disk: {e}")

    def run(self):
        logger.info("Watchdog service started")
        logger.info(
            f"Configuration: check_interval={self.check_interval}s, orphan_age={self.orphan_age_minutes}min"
        )

        while self.running:
            try:
                self.check_orphaned_workers()
                self.check_memory_usage()
                self.check_disk_usage()
            except Exception as e:
                logger.error(f"Error in watchdog check: {e}")

            time.sleep(self.check_interval)

        logger.info("Watchdog service stopped")


if __name__ == "__main__":
    service = WatchdogService()
    service.run()
