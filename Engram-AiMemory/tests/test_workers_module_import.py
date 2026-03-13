import importlib


def test_workers_module_imports(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "local-dev-jwt-secret-0123456789abcdef0123456789abcdef")

    workers_module = importlib.import_module("memory_system.workers")

    assert hasattr(workers_module, "MaintenanceScheduler")
