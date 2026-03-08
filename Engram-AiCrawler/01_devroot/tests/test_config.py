import yaml
from pathlib import Path


def test_config_yml_exists():
    config_path = Path(__file__).parent.parent / "config.yml"
    assert config_path.exists(), "config.yml does not exist"


def test_config_yml_structure():
    config_path = Path(__file__).parent.parent / "config.yml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    assert "app" in config, "Missing app section"
    assert "api" in config, "Missing api section"
    assert "crawl4ai" in config, "Missing crawl4ai section"
    assert "lm_studio" in config, "Missing lm_studio section"
    assert "redis" in config, "Missing redis section"
    assert "chromadb" in config, "Missing chromadb section"
    assert "data_lifecycle" in config, "Missing data_lifecycle section"
    assert "watchdog" in config, "Missing watchdog section"
    assert "osint" in config, "Missing osint section"
    assert "logging" in config, "Missing logging section"


def test_config_required_values():
    config_path = Path(__file__).parent.parent / "config.yml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    assert config["app"]["name"] == "crawl4ai-osint"
    assert config["api"]["port"] == 11235
    assert config["crawl4ai"]["version"] == "0.7.4"
    assert config["watchdog"]["check_interval_seconds"] == 30
    assert config["data_lifecycle"]["offload_threshold_days"] == 3


def test_dockerfile_exists():
    dockerfile_path = Path(__file__).parent.parent / "Dockerfile"
    assert dockerfile_path.exists(), "Dockerfile does not exist"


def test_dockerfile_content():
    dockerfile_path = Path(__file__).parent.parent / "Dockerfile"
    content = dockerfile_path.read_text()

    assert "python:3.11-slim" in content, "Wrong Python version"
    # crawl4ai version is in requirements.txt, not directly in Dockerfile
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    req_content = requirements_path.read_text()
    assert "crawl4ai" in req_content, "Crawl4AI missing from requirements.txt"
    assert "chromadb" in content or "chromadb" in req_content, "ChromaDB missing"
    assert "fastapi" in content or "fastapi" in req_content, "FastAPI missing"
    assert 'VOLUME ["/dev/shm"]' in content or "/dev/shm" in content, "Shared memory not set"
    assert "HEALTHCHECK" in content, "Healthcheck missing"


def test_docker_compose_exists():
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"
    assert compose_path.exists(), "docker-compose.yml does not exist"


def test_docker_compose_services():
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"
    with open(compose_path) as f:
        compose = yaml.safe_load(f)

    assert "services" in compose, "Missing services section"
    assert "crawl4ai" in compose["services"], "Missing crawl4ai service"
    assert "redis" in compose["services"], "Missing redis service"
    assert compose["services"]["crawl4ai"]["shm_size"] == "3g", "Shared memory not 3GB"


def test_dockerignore_exists():
    dockerignore_path = Path(__file__).parent.parent / ".dockerignore"
    assert dockerignore_path.exists(), ".dockerignore does not exist"


def test_dockerignore_excludes():
    dockerignore_path = Path(__file__).parent.parent / ".dockerignore"
    content = dockerignore_path.read_text()

    assert ".git" in content, "Git not excluded"
    assert "__pycache__" in content, "Python cache not excluded"
    assert "*.pyc" in content or "*.py[" in content, "Python bytecode not excluded"
    assert ".env" in content, ".env not excluded"
    assert "node_modules" in content, "Node modules not excluded"


def test_supervisord_conf_exists():
    supervisord_path = Path(__file__).parent.parent / "supervisord.conf"
    assert supervisord_path.exists(), "supervisord.conf does not exist"


def test_supervisord_services():
    supervisord_path = Path(__file__).parent.parent / "supervisord.conf"
    content = supervisord_path.read_text()

    assert "[program:crawl4ai]" in content, "Missing crawl4ai program"
    assert "[program:lm_bridge]" in content, "Missing lm_bridge program"
    assert "[program:watchdog]" in content, "Missing watchdog program"
    assert "[program:cleanup]" in content, "Missing cleanup program"


def test_env_example_exists():
    env_path = Path(__file__).parent.parent / ".env.example"
    assert env_path.exists(), ".env.example does not exist"


def test_env_example_variables():
    env_path = Path(__file__).parent.parent / ".env.example"
    content = env_path.read_text()

    assert "APP_NAME=" in content, "Missing APP_NAME"
    assert "LM_STUDIO_URL=" in content, "Missing LM_STUDIO_URL"
    assert "REDIS_URL=" in content, "Missing REDIS_URL"
    assert "CHROMADB_PATH=" in content, "Missing CHROMADB_PATH"


def test_directory_structure():
    base = Path(__file__).parent.parent
    required_dirs = [
        "app",
        "app/api",
        "app/websocket",
        "app/services",
        "app/orchestrators",
        "app/osint",
        "app/storage",
        "app/pipelines",
        "app/models",
        "scripts",
        "data",
        "data/cache",
        "data/logs",
        "data/tiers",
        "data/tiers/hot",
        "data/tiers/warm",
        "data/tiers/cold",
        "data/tiers/archive",
        "data/chroma",
        "frontend",
        "frontend/src",
        "tests",
    ]

    for dir_path in required_dirs:
        assert (base / dir_path).exists(), f"Missing directory: {dir_path}"


def test_scripts_executable():
    base = Path(__file__).parent.parent
    start_script = base / "scripts" / "start.sh"
    healthcheck_script = base / "scripts" / "healthcheck.sh"

    assert start_script.exists(), "start.sh missing"
    assert healthcheck_script.exists(), "healthcheck.sh missing"

    import stat

    assert start_script.stat().st_mode & stat.S_IXUSR, "start.sh not executable"
    assert healthcheck_script.stat().st_mode & stat.S_IXUSR, "healthcheck.sh not executable"
