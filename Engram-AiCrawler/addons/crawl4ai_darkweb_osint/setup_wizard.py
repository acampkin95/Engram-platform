"""
Interactive setup wizard for Dark Web OSINT addon.

Guides users through:
1. Tor proxy configuration
2. LLM provider selection
3. Connection validation
4. Configuration persistence
"""

import asyncio
import os
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

from crawl4ai_darkweb_osint.config import (
    DarkWebConfig,
    TorConfig,
    LLMProviderConfig,
)


class SetupStep(Enum):
    """Setup wizard steps."""

    WELCOME = "welcome"
    TOR_CONFIG = "tor_config"
    LLM_PROVIDER = "llm_provider"
    LLM_MODEL = "llm_model"
    VALIDATION = "validation"
    SAVE = "save"
    COMPLETE = "complete"


@dataclass
class WizardState:
    """State for the setup wizard."""

    step: SetupStep = SetupStep.WELCOME
    tor_host: str = "127.0.0.1"
    tor_port: int = 9050
    tor_control_port: int = 9051
    llm_provider: str = "lmstudio"
    llm_model: str = "glm-5"
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    tor_valid: bool = False
    llm_valid: bool = False
    error_message: Optional[str] = None


class SetupWizard:
    """
    Interactive setup wizard for first-time configuration.

    Usage:
        wizard = SetupWizard()
        await wizard.run()
    """

    LLM_PROVIDERS = {
        "lmstudio": {
            "name": "LM Studio",
            "description": "Local LLM via OpenAI-compatible API",
            "default_url": "http://localhost:1234/v1",
            "default_model": "glm-5",
            "requires_api_key": False,
        },
        "ollama": {
            "name": "Ollama",
            "description": "Local LLM via Ollama",
            "default_url": "http://localhost:11434/v1",
            "default_model": "llama3",
            "requires_api_key": False,
        },
        "openai": {
            "name": "OpenAI",
            "description": "Cloud API (GPT-4, GPT-3.5)",
            "default_url": "https://api.openai.com/v1",
            "default_model": "gpt-4",
            "requires_api_key": True,
        },
        "anthropic": {
            "name": "Anthropic",
            "description": "Cloud API (Claude)",
            "default_url": "https://api.anthropic.com/v1",
            "default_model": "claude-3-opus-20240229",
            "requires_api_key": True,
        },
        "minimax": {
            "name": "Minimax",
            "description": "Cloud API (M2.5 HighSpeed)",
            "default_url": "https://api.minimax.chat/v1",
            "default_model": "minimax-m2.5-highspeed",
            "requires_api_key": True,
        },
    }

    def __init__(self, config_path: Optional[Path] = None):
        self.state = WizardState()
        self.config_path = (
            config_path or Path.home() / ".crawl4ai" / "darkweb_config.json"
        )
        self._config: Optional[DarkWebConfig] = None

    async def run(self, non_interactive: bool = False) -> DarkWebConfig:
        """
        Run the setup wizard.

        Args:
            non_interactive: If True, use environment variables and defaults

        Returns:
            Configured DarkWebConfig
        """
        if non_interactive:
            return await self._run_non_interactive()

        # Interactive mode
        print("\n" + "=" * 60)
        print("  Crawl4AI Dark Web OSINT - Setup Wizard")
        print("=" * 60 + "\n")

        # Step 1: Tor configuration
        print("Step 1: Tor Proxy Configuration")
        print("-" * 40)
        self.state.tor_host = self._prompt_with_default(
            "Tor proxy host", self.state.tor_host
        )
        self.state.tor_port = int(
            self._prompt_with_default("Tor SOCKS port", str(self.state.tor_port))
        )
        self.state.tor_control_port = int(
            self._prompt_with_default(
                "Tor control port", str(self.state.tor_control_port)
            )
        )

        # Validate Tor
        print("\nValidating Tor connection...")
        tor_result = await self.check_tor()
        self.state.tor_valid = tor_result["connected"]

        if self.state.tor_valid:
            print(f"✓ Tor connected! IP: {tor_result.get('ip', 'unknown')}")
        else:
            print(
                f"✗ Tor connection failed: {tor_result.get('error', 'unknown error')}"
            )
            print("  (You can continue setup, but Tor must be running before use)")

        # Step 2: LLM provider selection
        print("\n\nStep 2: LLM Provider Selection")
        print("-" * 40)
        print("Available providers:")
        for i, (key, info) in enumerate(self.LLM_PROVIDERS.items(), 1):
            print(f"  {i}. {info['name']} - {info['description']}")

        provider_choice = self._prompt_with_default("Select provider (1-5)", "1")
        providers = list(self.LLM_PROVIDERS.keys())
        self.state.llm_provider = providers[int(provider_choice) - 1]

        provider_info = self.LLM_PROVIDERS[self.state.llm_provider]
        print(f"\nSelected: {provider_info['name']}")

        # Step 3: LLM configuration
        print("\nStep 3: LLM Model Configuration")
        print("-" * 40)

        self.state.llm_model = self._prompt_with_default(
            "Model name", provider_info["default_model"]
        )

        self.state.llm_base_url = self._prompt_with_default(
            "API base URL", provider_info["default_url"]
        )

        if provider_info["requires_api_key"]:
            self.state.llm_api_key = os.getenv(
                f"{self.state.llm_provider.upper()}_API_KEY"
            )
            if not self.state.llm_api_key:
                self.state.llm_api_key = input("API key: ").strip()

        # Validate LLM
        print("\nValidating LLM connection...")
        llm_result = await self.check_llm()
        self.state.llm_valid = llm_result.get("valid", False)

        if self.state.llm_valid:
            print("✓ LLM connection successful!")
        else:
            print(
                f"✗ LLM connection failed: {llm_result.get('error', 'unknown error')}"
            )
            print("  (You can continue setup, but LLM must be configured before use)")

        # Step 4: Save configuration
        print("\n\nStep 4: Save Configuration")
        print("-" * 40)

        self._config = self._build_config()

        save_choice = self._prompt_with_default(
            "Save configuration? (Y/n)", "Y"
        ).lower()

        if save_choice != "n":
            self.save_config()
            print(f"✓ Configuration saved to {self.config_path}")

            # Generate .env template
            env_template = self.generate_env_template()
            env_path = self.config_path.parent / ".env.darkweb"
            env_path.write_text(env_template)
            print(f"✓ Environment template saved to {env_path}")

        print("\n" + "=" * 60)
        print("  Setup Complete!")
        print("=" * 60)

        return self._config

    async def _run_non_interactive(self) -> DarkWebConfig:
        """Run setup using environment variables and defaults."""
        self.state.tor_host = os.getenv("DARKWEB_TOR_PROXY_HOST", "127.0.0.1")
        self.state.tor_port = int(os.getenv("DARKWEB_TOR_PROXY_PORT", "9050"))
        self.state.tor_control_port = int(os.getenv("DARKWEB_TOR_CONTROL_PORT", "9051"))
        self.state.llm_provider = os.getenv("DARKWEB_LLM_PROVIDER", "lmstudio")
        self.state.llm_model = os.getenv("DARKWEB_LLM_MODEL", "glm-5")
        self.state.llm_base_url = os.getenv("DARKWEB_LLM_BASE_URL")
        self.state.llm_api_key = os.getenv("DARKWEB_LLM_API_KEY")

        self._config = self._build_config()
        self.save_config()

        return self._config

    def _prompt_with_default(self, prompt: str, default: str) -> str:
        """Prompt user with default value."""
        result = input(f"{prompt} [{default}]: ").strip()
        return result if result else default

    def _build_config(self) -> DarkWebConfig:
        """Build DarkWebConfig from wizard state."""
        tor = TorConfig(
            host=self.state.tor_host,
            port=self.state.tor_port,
            control_port=self.state.tor_control_port,
        )

        llm = LLMProviderConfig(
            provider=self.state.llm_provider,  # type: ignore
            model=self.state.llm_model,
            base_url=self.state.llm_base_url,
            api_key=self.state.llm_api_key,
        )

        return DarkWebConfig(tor=tor, llm=llm)

    async def check_tor(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Check Tor connection.

        Args:
            host: Override configured host
            port: Override configured port

        Returns:
            Dict with 'connected', 'ip', 'error' keys
        """
        from crawl4ai_darkweb_osint.tor_proxy import check_tor_connection

        return await check_tor_connection(
            host or self.state.tor_host,
            port or self.state.tor_port,
        )

    async def check_llm(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Check LLM provider connection.

        Args:
            provider: Override configured provider
            model: Override configured model
            base_url: Override configured base URL
            api_key: Override configured API key

        Returns:
            Dict with 'valid', 'error' keys
        """
        try:
            config = LLMProviderConfig(
                provider=provider or self.state.llm_provider,  # type: ignore
                model=model or self.state.llm_model,
                base_url=base_url or self.state.llm_base_url,
                api_key=api_key or self.state.llm_api_key,
            )

            from crawl4ai_darkweb_osint.llm_providers import get_llm_client

            client = get_llm_client(config)

            # Try a simple generation
            response = await client.generate("Say 'OK' if you can hear me.")

            if hasattr(client, "close"):
                await client.close()

            return {"valid": True, "response": response[:50]}

        except Exception as e:
            return {"valid": False, "error": str(e)}

    def save_config(self) -> None:
        """Save configuration to file."""
        if self._config is None:
            raise ValueError("No configuration to save")

        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self._config.save()

    def generate_env_template(self) -> str:
        """Generate .env template string."""
        if self._config is None:
            self._config = self._build_config()

        return self._config.to_env_template()

    def get_config(self) -> DarkWebConfig:
        """Get the configured DarkWebConfig."""
        if self._config is None:
            self._config = self._build_config()
        return self._config


# Validation functions for programmatic use
async def validate_tor_config(host: str, port: int) -> Dict[str, Any]:
    """
    Validate Tor configuration.

    Args:
        host: Tor proxy host
        port: Tor SOCKS port

    Returns:
        Dict with 'valid', 'error' keys
    """
    from crawl4ai_darkweb_osint.tor_proxy import check_tor_connection

    result = await check_tor_connection(host, port)

    return {
        "valid": result.get("connected", False),
        "error": result.get("error"),
        "ip": result.get("ip"),
    }


async def validate_llm_config(
    provider: str,
    model: str,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate LLM configuration.

    Args:
        provider: LLM provider name
        model: Model name
        base_url: API base URL
        api_key: API key

    Returns:
        Dict with 'valid', 'error' keys
    """
    wizard = SetupWizard()
    wizard.state.llm_provider = provider
    wizard.state.llm_model = model
    wizard.state.llm_base_url = base_url
    wizard.state.llm_api_key = api_key

    return await wizard.check_llm()


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dark Web OSINT Setup Wizard")
    parser.add_argument(
        "--non-interactive", action="store_true", help="Use defaults and env vars"
    )
    parser.add_argument(
        "--check-tor", action="store_true", help="Check Tor connection only"
    )
    parser.add_argument(
        "--check-llm", action="store_true", help="Check LLM connection only"
    )
    parser.add_argument(
        "--generate-env", action="store_true", help="Generate .env template"
    )

    args = parser.parse_args()

    async def main():
        wizard = SetupWizard()

        if args.check_tor:
            result = await wizard.check_tor()
            print(f"Tor connection: {'OK' if result.get('connected') else 'FAILED'}")
            if result.get("ip"):
                print(f"Exit IP: {result['ip']}")
            if result.get("error"):
                print(f"Error: {result['error']}")

        elif args.check_llm:
            result = await wizard.check_llm()
            print(f"LLM connection: {'OK' if result.get('valid') else 'FAILED'}")
            if result.get("error"):
                print(f"Error: {result['error']}")

        elif args.generate_env:
            config = wizard.get_config()
            print(config.to_env_template())

        else:
            await wizard.run(non_interactive=args.non_interactive)

    asyncio.run(main())
