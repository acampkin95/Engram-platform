import importlib


def test_api_module_imports_with_validation_handler(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "local-dev-jwt-secret-0123456789abcdef0123456789abcdef")

    api_module = importlib.import_module("memory_system.api")

    assert hasattr(api_module, "validation_exception_handler")
