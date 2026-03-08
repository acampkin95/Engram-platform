import pytest
import subprocess
from pathlib import Path


def test_docker_build():
    base_dir = Path(__file__).parent.parent
    dockerfile = base_dir / "Dockerfile"

    if not dockerfile.exists():
        pytest.skip("Dockerfile not found")

    # Check if Docker daemon is available
    daemon_check = subprocess.run(
        ["docker", "info"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if daemon_check.returncode != 0:
        pytest.skip("Docker daemon not available")

    result = subprocess.run(
        [
            "docker",
            "build",
            "-t",
            "crawl4ai-osint:test",
            "-f",
            str(dockerfile),
            str(base_dir),
        ],
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        pytest.fail(f"Docker build failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")


def test_docker_compose_syntax():
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"
    result = subprocess.run(
        ["docker", "compose", "-f", str(compose_path), "config"],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, f"docker-compose syntax error:\n{result.stderr}"


def test_dockerfile_syntax():
    base_dir = Path(__file__).parent.parent
    dockerfile = base_dir / "Dockerfile"

    if not dockerfile.exists():
        pytest.skip("Dockerfile not found")

    content = dockerfile.read_text()

    assert "FROM" in content, "Missing FROM instruction"
    assert "RUN" in content, "Missing RUN instruction"
    assert "COPY" in content, "Missing COPY instruction"
    assert "EXPOSE" in content, "Missing EXPOSE instruction"
    assert "CMD" in content, "Missing CMD instruction"


def test_requirements_txt_exists():
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    assert requirements_path.exists(), "requirements.txt does not exist"


def test_requirements_content():
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    content = requirements_path.read_text()

    assert "crawl4ai[all]==0.7.4" in content, "Crawl4AI version incorrect"
    assert "chromadb" in content, "ChromaDB missing"
    assert "fastapi" in content, "FastAPI missing"
    assert "uvicorn" in content, "Uvicorn missing"
