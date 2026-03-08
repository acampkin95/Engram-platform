"""Email OSINT service — breach checking, verification and reverse lookup.

Uses HIBP v3 and Hunter.io APIs when keys are available, with keyless
fallbacks (MX record checks, domain WHOIS enrichment).
"""


from __future__ import annotations
import asyncio
import logging
import re

import aiohttp

from app.config.osint_providers import get_osint_settings, osint_cache
from app.core.exceptions import OsintServiceError, ProviderRateLimitError, ProviderUnavailableError
from app.models.osint import (
    BreachCheckResponse,
    BreachInfo,
    BulkEmailCheckItem,
    BulkEmailCheckResponse,
    EmailReverseResponse,
    EmailVerifyResponse,
)

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _validate_email(email: str) -> str:
    email = email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise OsintServiceError(f"Invalid email address: {email}", status_code=400)
    return email


def _get_domain(email: str) -> str:
    return email.split("@")[1]


class EmailOsintService:
    """Provides email breach checking, verification, and reverse lookups."""

    def __init__(self, session: aiohttp.ClientSession | None = None) -> None:
        self._settings = get_osint_settings()
        self._session = session

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    # -----------------------------------------------------------------------
    # Breach Checking (HIBP)
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=86400, prefix="email:breach")
    async def check_breach(self, email: str) -> BreachCheckResponse:
        """Check an email against Have I Been Pwned."""
        email = _validate_email(email)
        cfg = self._settings.hibp

        if cfg.has_api_key:
            return await self._hibp_api_check(email)

        # Keyless fallback: check if the domain appears in known breaches
        return await self._hibp_keyless_check(email)

    async def _hibp_api_check(self, email: str) -> BreachCheckResponse:
        cfg = self._settings.hibp
        session = await self._get_session()

        headers = {
            "hibp-api-key": cfg.api_key,
            "user-agent": "Crawl4AI-OSINT/1.0",
        }

        try:
            url = f"{cfg.base_url}/breachedaccount/{email}"
            params = {"truncateResponse": "false"}
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status == 429:
                    retry_after = int(resp.headers.get("retry-after", "2"))
                    raise ProviderRateLimitError(
                        "HIBP rate limit exceeded",
                        provider="hibp",
                        retry_after=retry_after,
                    )
                if resp.status == 404:
                    return BreachCheckResponse(email=email, breached=False)
                if resp.status == 401:
                    raise ProviderUnavailableError("Invalid HIBP API key")
                resp.raise_for_status()
                data = await resp.json()

            breaches = [
                BreachInfo(
                    name=b.get("Name", ""),
                    title=b.get("Title"),
                    domain=b.get("Domain"),
                    breach_date=b.get("BreachDate"),
                    added_date=b.get("AddedDate"),
                    pwn_count=b.get("PwnCount"),
                    data_classes=b.get("DataClasses", []),
                    description=b.get("Description"),
                    is_verified=b.get("IsVerified", True),
                )
                for b in data
            ]

            return BreachCheckResponse(
                email=email,
                breached=len(breaches) > 0,
                breach_count=len(breaches),
                breaches=breaches,
                fallback_used=False,
            )
        except (ProviderRateLimitError, ProviderUnavailableError):
            raise
        except Exception as exc:
            logger.error(f"HIBP API check failed for {email}: {exc}")
            raise OsintServiceError(f"Breach check failed: {exc}")

    async def _hibp_keyless_check(self, email: str) -> BreachCheckResponse:
        """Keyless fallback: check domain-level breaches via HIBP public data."""
        session = await self._get_session()
        domain = _get_domain(email)

        try:
            url = "https://haveibeenpwned.com/api/v3/breaches"
            headers = {"user-agent": "Crawl4AI-OSINT/1.0"}
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    return BreachCheckResponse(email=email, breached=False, fallback_used=True)
                all_breaches = await resp.json()

            domain_breaches = [
                BreachInfo(
                    name=b.get("Name", ""),
                    title=b.get("Title"),
                    domain=b.get("Domain"),
                    breach_date=b.get("BreachDate"),
                    pwn_count=b.get("PwnCount"),
                    data_classes=b.get("DataClasses", []),
                    is_verified=b.get("IsVerified", True),
                )
                for b in all_breaches
                if b.get("Domain", "").lower() == domain
            ]

            return BreachCheckResponse(
                email=email,
                breached=len(domain_breaches) > 0,
                breach_count=len(domain_breaches),
                breaches=domain_breaches,
                fallback_used=True,
            )
        except Exception as exc:
            logger.debug(f"HIBP keyless check failed: {exc}")
            return BreachCheckResponse(email=email, breached=False, fallback_used=True)

    # -----------------------------------------------------------------------
    # Email Verification
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=604800, prefix="email:verify")
    async def verify_email(self, email: str) -> EmailVerifyResponse:
        """Verify email deliverability via Hunter.io or MX fallback."""
        email = _validate_email(email)
        cfg = self._settings.hunter

        if cfg.has_api_key:
            return await self._hunter_verify(email)

        return await self._mx_verify(email)

    async def _hunter_verify(self, email: str) -> EmailVerifyResponse:
        cfg = self._settings.hunter
        session = await self._get_session()

        try:
            url = f"{cfg.base_url}/email-verifier"
            params = {"email": email, "api_key": cfg.api_key}
            async with session.get(url, params=params) as resp:
                if resp.status == 429:
                    raise ProviderRateLimitError("Hunter.io rate limit exceeded", provider="hunter")
                if resp.status == 401:
                    raise ProviderUnavailableError("Invalid Hunter.io API key")
                resp.raise_for_status()
                data = await resp.json()

            result = data.get("data", {})
            return EmailVerifyResponse(
                email=email,
                status=result.get("status", "unknown"),
                score=result.get("score"),
                mx_found=result.get("mx_records", False),
                disposable=result.get("disposable", False),
                role_based=result.get("role", False),
                free_provider=result.get("free", False),
                smtp_check=result.get("smtp_check"),
                fallback_used=False,
            )
        except (ProviderRateLimitError, ProviderUnavailableError):
            raise
        except Exception as exc:
            logger.error(f"Hunter verify failed for {email}: {exc}")
            raise OsintServiceError(f"Email verification failed: {exc}")

    async def _mx_verify(self, email: str) -> EmailVerifyResponse:
        """Keyless fallback: check MX records to verify domain accepts email."""
        domain = _get_domain(email)
        loop = asyncio.get_event_loop()

        mx_found = False
        try:
            import dns.resolver

            answers = await loop.run_in_executor(None, lambda: dns.resolver.resolve(domain, "MX"))
            mx_found = len(list(answers)) > 0
        except ImportError:
            # dnspython not available — try dns.google
            session = await self._get_session()
            try:
                url = f"https://dns.google/resolve?name={domain}&type=MX"
                async with session.get(url) as resp:
                    data = await resp.json()
                    mx_found = len(data.get("Answer", [])) > 0
            except Exception:
                pass
        except Exception:
            pass

        # Basic heuristics
        free_providers = {
            "gmail.com",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "protonmail.com",
            "icloud.com",
            "aol.com",
            "mail.com",
        }
        disposable_indicators = {
            "tempmail",
            "throwaway",
            "guerrilla",
            "mailinator",
            "trashmail",
            "yopmail",
            "sharklasers",
            "grr.la",
        }

        is_free = domain in free_providers
        is_disposable = any(ind in domain for ind in disposable_indicators)

        status = "unknown"
        if mx_found:
            status = "deliverable" if not is_disposable else "risky"
        elif is_disposable:
            status = "invalid"

        local_part = email.split("@")[0]
        role_parts = {"admin", "info", "support", "sales", "contact", "noreply", "no-reply"}
        is_role = local_part in role_parts

        return EmailVerifyResponse(
            email=email,
            status=status,
            mx_found=mx_found,
            disposable=is_disposable,
            role_based=is_role,
            free_provider=is_free,
            fallback_used=True,
        )

    # -----------------------------------------------------------------------
    # Reverse Lookup
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=604800, prefix="email:reverse")
    async def reverse_lookup(self, email: str) -> EmailReverseResponse:
        """Reverse-lookup an email to find associated person/company info."""
        email = _validate_email(email)
        cfg = self._settings.hunter

        if cfg.has_api_key:
            return await self._hunter_reverse(email)

        # Keyless fallback: extract what we can from the email itself
        return self._email_heuristic_reverse(email)

    async def _hunter_reverse(self, email: str) -> EmailReverseResponse:
        cfg = self._settings.hunter
        session = await self._get_session()

        try:
            url = f"{cfg.base_url}/email-finder"
            params = {"email": email, "api_key": cfg.api_key}
            async with session.get(url, params=params) as resp:
                if resp.status == 429:
                    raise ProviderRateLimitError("Hunter.io rate limit exceeded", provider="hunter")
                resp.raise_for_status()
                data = await resp.json()

            result = data.get("data", {})
            return EmailReverseResponse(
                email=email,
                first_name=result.get("first_name"),
                last_name=result.get("last_name"),
                company=result.get("company"),
                position=result.get("position"),
                linkedin_url=result.get("linkedin"),
                twitter_handle=result.get("twitter"),
                phone=result.get("phone_number"),
                confidence=result.get("confidence"),
                sources=[s.get("uri", "") for s in result.get("sources", [])[:10]],
                fallback_used=False,
            )
        except (ProviderRateLimitError, ProviderUnavailableError):
            raise
        except Exception as exc:
            logger.error(f"Hunter reverse lookup failed for {email}: {exc}")
            raise OsintServiceError(f"Reverse lookup failed: {exc}")

    def _email_heuristic_reverse(self, email: str) -> EmailReverseResponse:
        """Extract basic info from email address patterns (keyless)."""
        local_part = email.split("@")[0]
        domain = _get_domain(email)

        first_name = None
        last_name = None

        # Try common patterns: first.last, first_last, firstlast
        if "." in local_part:
            parts = local_part.split(".")
            first_name = parts[0].capitalize()
            last_name = parts[-1].capitalize()
        elif "_" in local_part:
            parts = local_part.split("_")
            first_name = parts[0].capitalize()
            last_name = parts[-1].capitalize()

        # Company from domain
        company = domain.split(".")[0].capitalize() if domain else None
        free_providers = {
            "gmail.com",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "protonmail.com",
            "icloud.com",
        }
        if domain in free_providers:
            company = None

        return EmailReverseResponse(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company=company,
            fallback_used=True,
        )

    # -----------------------------------------------------------------------
    # Bulk Operations
    # -----------------------------------------------------------------------

    async def bulk_check(self, emails: list[str]) -> BulkEmailCheckResponse:
        """Check multiple emails for breaches."""
        if len(emails) > 100:
            raise OsintServiceError("Maximum 100 emails per bulk check", status_code=400)

        results: list[BulkEmailCheckItem] = []
        breached_count = 0
        errors = 0

        # Process with concurrency limit to respect rate limits
        semaphore = asyncio.Semaphore(5)

        async def _check_one(email_raw: str) -> BulkEmailCheckItem:
            async with semaphore:
                try:
                    email = _validate_email(email_raw)
                    resp = await self.check_breach(email)
                    return BulkEmailCheckItem(
                        email=email,
                        breached=resp.breached,
                        breach_count=resp.breach_count,
                    )
                except Exception as exc:
                    return BulkEmailCheckItem(
                        email=email_raw.strip(),
                        breached=False,
                        error=str(exc),
                    )

        items = await asyncio.gather(*[_check_one(e) for e in emails])
        for item in items:
            results.append(item)
            if item.breached:
                breached_count += 1
            if item.error:
                errors += 1

        return BulkEmailCheckResponse(
            results=results,
            total=len(results),
            breached_count=breached_count,
            errors=errors,
            fallback_used=self._settings.hibp.has_api_key is False,
        )
