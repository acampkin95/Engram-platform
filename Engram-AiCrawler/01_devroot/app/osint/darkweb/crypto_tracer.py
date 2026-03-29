"""
Cryptocurrency Address Tracer — Phase 8.4

Traces Bitcoin and Ethereum addresses via public blockchain APIs:
  - Blockchain.info API (BTC)
  - Blockchair API (BTC/ETH/multi-chain)
  - Etherscan API (ETH)
  - OSINT heuristics for exchange identification

No API keys required for basic lookups. Etherscan key optional for
higher rate limits.

Env vars (optional):
  ETHERSCAN_API_KEY
  BLOCKCHAIR_API_KEY
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime
from app._compat import UTC

from app._compat import StrEnum

from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class CryptoNetwork(StrEnum):
    BITCOIN = "bitcoin"
    ETHEREUM = "ethereum"
    LITECOIN = "litecoin"
    MONERO = "monero"  # Note: Monero is privacy coin, limited tracing
    UNKNOWN = "unknown"

class AddressRisk(StrEnum):
    CRITICAL = "critical"  # Known scam/darknet market/sanctioned
    HIGH = "high"  # Mixer/tumbler, high-risk exchange
    MEDIUM = "medium"  # Unhosted wallet, peer-to-peer
    LOW = "low"  # Known exchange, regulated
    CLEAN = "clean"  # Verified clean / no risk signals

@dataclass
class Transaction:
    """A single blockchain transaction."""

    tx_hash: str
    block_height: int | None
    timestamp: datetime | None
    value_native: float  # In native currency (BTC, ETH)
    value_usd: float | None
    fee_native: float | None
    direction: str  # "in" or "out"
    counterparty_addresses: list[str]
    confirmations: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "tx_hash": self.tx_hash,
            "block_height": self.block_height,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "value_native": self.value_native,
            "value_usd": self.value_usd,
            "fee_native": self.fee_native,
            "direction": self.direction,
            "counterparty_addresses": self.counterparty_addresses,
            "confirmations": self.confirmations,
        }

@dataclass
class AddressProfile:
    """Full profile of a cryptocurrency address."""

    address: str
    network: CryptoNetwork
    balance_native: float
    balance_usd: float | None
    total_received: float
    total_sent: float
    transaction_count: int
    first_seen: datetime | None
    last_seen: datetime | None
    transactions: list[Transaction]
    risk_level: AddressRisk
    risk_signals: list[str]
    exchange_label: str | None  # "Binance", "Coinbase", etc.
    cluster_addresses: list[str]  # Co-spent addresses (BTC heuristic)
    queried_at: datetime
    data_source: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "address": self.address,
            "network": self.network.value,
            "balance_native": self.balance_native,
            "balance_usd": self.balance_usd,
            "total_received": self.total_received,
            "total_sent": self.total_sent,
            "transaction_count": self.transaction_count,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "transaction_count_shown": len(self.transactions),
            "transactions": [t.to_dict() for t in self.transactions[:10]],
            "risk_level": self.risk_level.value,
            "risk_signals": self.risk_signals,
            "exchange_label": self.exchange_label,
            "cluster_addresses": self.cluster_addresses[:20],
            "queried_at": self.queried_at.isoformat(),
            "data_source": self.data_source,
            "error": self.error,
        }

@dataclass
class CryptoTraceResult:
    """Result of tracing one or more crypto addresses."""

    scan_id: str
    addresses_queried: list[str]
    profiles: list[AddressProfile]
    total_usd_value: float | None
    highest_risk: AddressRisk
    network_summary: dict[str, int]  # network -> address count
    scan_duration_s: float
    scanned_at: datetime
    errors: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "addresses_queried": self.addresses_queried,
            "total_profiles": len(self.profiles),
            "total_usd_value": self.total_usd_value,
            "highest_risk": self.highest_risk.value,
            "network_summary": self.network_summary,
            "profiles": [p.to_dict() for p in self.profiles],
            "scan_duration_s": self.scan_duration_s,
            "scanned_at": self.scanned_at.isoformat(),
            "errors": self.errors,
        }

# ---------------------------------------------------------------------------
# Address Detection
# ---------------------------------------------------------------------------

_BTC_REGEX = re.compile(r"\b(bc1[a-zA-HJ-NP-Z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
_ETH_REGEX = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")
_LTC_REGEX = re.compile(r"\b([LM][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-z0-9]{25,87})\b")
_XMR_REGEX = re.compile(r"\b(4[0-9AB][1-9A-HJ-NP-Za-km-z]{93})\b")

def detect_crypto_addresses(text: str) -> dict[str, list[str]]:
    """
    Extract all cryptocurrency addresses from text.

    Returns dict mapping network name to list of addresses found.
    """
    return {
        "bitcoin": list(dict.fromkeys(_BTC_REGEX.findall(text))),
        "ethereum": list(dict.fromkeys(_ETH_REGEX.findall(text))),
        "litecoin": list(dict.fromkeys(_LTC_REGEX.findall(text))),
        "monero": list(dict.fromkeys(_XMR_REGEX.findall(text))),
    }

def classify_address_network(address: str) -> CryptoNetwork:
    """Detect which blockchain network an address belongs to."""
    if _BTC_REGEX.match(address):
        return CryptoNetwork.BITCOIN
    if _ETH_REGEX.match(address):
        return CryptoNetwork.ETHEREUM
    if _LTC_REGEX.match(address):
        return CryptoNetwork.LITECOIN
    if _XMR_REGEX.match(address):
        return CryptoNetwork.MONERO
    return CryptoNetwork.UNKNOWN

# ---------------------------------------------------------------------------
# Known Exchange Address Prefixes / Clusters
# ---------------------------------------------------------------------------

# Known exchange hot wallet address prefixes (public OSINT data)
KNOWN_EXCHANGE_ADDRESSES: dict[str, str] = {
    # Bitcoin known exchange addresses (examples — real OSINT would have many more)
    "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s": "Binance",
    "3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B": "Coinbase",
    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh": "Binance",
    # Ethereum
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance",
    "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance",
    "0xa090e606e30bd747d4e6245a1517ebe430f0057e": "Coinbase",
}

# High-risk address labels (mixers, darknet markets — public OSINT)
HIGH_RISK_LABELS: dict[str, str] = {
    # These are illustrative — real system would pull from OFAC, Chainalysis feeds
    "1Bh9RBsB7u3VPbGwNwMkjFqFJwrHsNJdAD": "Known Mixer",
}

def _lookup_exchange_label(address: str) -> str | None:
    """Check if address is a known exchange."""
    return KNOWN_EXCHANGE_ADDRESSES.get(address)

def _lookup_risk_label(address: str) -> str | None:
    """Check if address is flagged as high-risk."""
    return HIGH_RISK_LABELS.get(address)

# ---------------------------------------------------------------------------
# Bitcoin Tracer (Blockchain.info)
# ---------------------------------------------------------------------------

class BitcoinTracer:
    """Query Bitcoin address data via Blockchain.info public API."""

    BASE_URL = "https://blockchain.info"

    async def get_address(
        self, address: str, max_txs: int = 50
    ) -> tuple[dict[str, Any] | None, str | None]:
        """Fetch address data. Returns (data, error)."""
        try:
            import aiohttp  # type: ignore

            url = f"{self.BASE_URL}/rawaddr/{address}"
            params = {"limit": min(max_txs, 50), "offset": 0}

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30),
                    headers={"User-Agent": "OSINT-Investigation-Platform/1.0"},
                ) as resp:
                    if resp.status == 200:
                        return await resp.json(), None
                    if resp.status == 429:
                        return None, "Rate limited by Blockchain.info"
                    return None, f"HTTP {resp.status}"

        except ImportError:
            return None, "aiohttp not installed"
        except Exception as exc:
            return None, str(exc)

    def parse_address(self, data: dict[str, Any], address: str) -> AddressProfile:
        """Parse Blockchain.info response into AddressProfile."""
        txs = []
        for tx in data.get("txs", []):
            # Determine direction
            out_addresses = []
            in_addresses = []
            value_out = 0
            value_in = 0

            for inp in tx.get("inputs", []):
                prev_out = inp.get("prev_out", {})
                addr = prev_out.get("addr", "")
                if addr == address:
                    value_out += prev_out.get("value", 0)
                else:
                    in_addresses.append(addr)

            for out in tx.get("out", []):
                addr = out.get("addr", "")
                if addr == address:
                    value_in += out.get("value", 0)
                else:
                    out_addresses.append(addr)

            direction = "in" if value_in > 0 else "out"
            value = (value_in if direction == "in" else value_out) / 1e8

            timestamp = tx.get("time")
            ts = datetime.fromtimestamp(timestamp, tz=UTC) if timestamp else None

            txs.append(
                Transaction(
                    tx_hash=tx.get("hash", ""),
                    block_height=tx.get("block_height"),
                    timestamp=ts,
                    value_native=value,
                    value_usd=None,
                    fee_native=(tx.get("fee", 0) or 0) / 1e8,
                    direction=direction,
                    counterparty_addresses=(out_addresses if direction == "in" else in_addresses),
                    confirmations=tx.get("confirmations", 0),
                )
            )

        # Timestamps
        all_times = [t.timestamp for t in txs if t.timestamp]
        first_seen = min(all_times) if all_times else None
        last_seen = max(all_times) if all_times else None

        balance = data.get("final_balance", 0) / 1e8
        total_received = data.get("total_received", 0) / 1e8
        total_sent = data.get("total_sent", 0) / 1e8

        risk_level, risk_signals = self._assess_risk(address, data, txs)

        return AddressProfile(
            address=address,
            network=CryptoNetwork.BITCOIN,
            balance_native=balance,
            balance_usd=None,
            total_received=total_received,
            total_sent=total_sent,
            transaction_count=data.get("n_tx", 0),
            first_seen=first_seen,
            last_seen=last_seen,
            transactions=txs,
            risk_level=risk_level,
            risk_signals=risk_signals,
            exchange_label=_lookup_exchange_label(address),
            cluster_addresses=[],  # Would need Chainalysis for clustering
            queried_at=datetime.now(UTC),
            data_source="blockchain.info",
        )

    def _assess_risk(
        self,
        address: str,
        data: dict[str, Any],
        txs: list[Transaction],
    ) -> tuple[AddressRisk, list[str]]:
        """Heuristic risk assessment for a BTC address."""
        signals = []

        # Known labels
        risk_label = _lookup_risk_label(address)
        if risk_label:
            signals.append(f"Known high-risk: {risk_label}")
            return AddressRisk.CRITICAL, signals

        exchange_label = _lookup_exchange_label(address)
        if exchange_label:
            signals.append(f"Known exchange: {exchange_label}")
            return AddressRisk.LOW, signals

        # Heuristics
        n_tx = data.get("n_tx", 0)
        balance = data.get("final_balance", 0) / 1e8

        if n_tx > 10000:
            signals.append(f"Very high transaction volume ({n_tx} txs) — possible exchange/mixer")

        if balance > 100:
            signals.append(f"Large balance ({balance:.2f} BTC)")

        # Check for rapid in/out pattern (tumbler behavior)
        in_txs = [t for t in txs if t.direction == "in"]
        out_txs = [t for t in txs if t.direction == "out"]
        if in_txs and out_txs and len(in_txs) > 5:
            # Check if funds move quickly
            signals.append("High in/out ratio — possible tumbler activity")

        if signals:
            return AddressRisk.MEDIUM, signals
        return AddressRisk.CLEAN, []

# ---------------------------------------------------------------------------
# Ethereum Tracer (Etherscan)
# ---------------------------------------------------------------------------

class EthereumTracer:
    """Query Ethereum address data via Etherscan API."""

    BASE_URL = "https://api.etherscan.io/api"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("ETHERSCAN_API_KEY", "")

    async def get_address(
        self, address: str, max_txs: int = 50
    ) -> tuple[dict[str, Any] | None, str | None]:
        """Fetch ETH balance and transactions."""
        try:
            import aiohttp  # type: ignore

            # Fetch balance and txlist in parallel
            async with aiohttp.ClientSession() as session:
                balance_params = {
                    "module": "account",
                    "action": "balance",
                    "address": address,
                    "tag": "latest",
                    "apikey": self.api_key or "YourApiKeyToken",
                }
                tx_params = {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "startblock": 0,
                    "endblock": 99999999,
                    "page": 1,
                    "offset": min(max_txs, 100),
                    "sort": "desc",
                    "apikey": self.api_key or "YourApiKeyToken",
                }

                balance_task = session.get(
                    self.BASE_URL,
                    params=balance_params,
                    timeout=aiohttp.ClientTimeout(total=30),
                )
                tx_task = session.get(
                    self.BASE_URL,
                    params=tx_params,
                    timeout=aiohttp.ClientTimeout(total=30),
                )

                async with balance_task as br, tx_task as tr:
                    if br.status != 200 or tr.status != 200:
                        return None, f"Etherscan HTTP {br.status}/{tr.status}"
                    balance_data = await br.json()
                    tx_data = await tr.json()

            return {
                "balance": balance_data,
                "transactions": tx_data,
            }, None

        except ImportError:
            return None, "aiohttp not installed"
        except Exception as exc:
            return None, str(exc)

    def parse_address(self, data: dict[str, Any], address: str) -> AddressProfile:
        """Parse Etherscan response into AddressProfile."""
        balance_data = data.get("balance", {})
        tx_data = data.get("transactions", {})

        # Balance in Wei -> ETH
        balance_wei = int(balance_data.get("result", 0) or 0)
        balance_eth = balance_wei / 1e18

        txs = []
        raw_txs = tx_data.get("result", []) or []
        if isinstance(raw_txs, list):
            for tx in raw_txs:
                value_wei = int(tx.get("value", 0) or 0)
                value_eth = value_wei / 1e18
                direction = "in" if tx.get("to", "").lower() == address.lower() else "out"
                ts_raw = tx.get("timeStamp")
                ts = datetime.fromtimestamp(int(ts_raw), tz=UTC) if ts_raw else None
                counterparty = tx.get("from", "") if direction == "in" else tx.get("to", "")
                gas_price = int(tx.get("gasPrice", 0) or 0)
                gas_used = int(tx.get("gasUsed", 0) or 0)
                fee_eth = (gas_price * gas_used) / 1e18

                txs.append(
                    Transaction(
                        tx_hash=tx.get("hash", ""),
                        block_height=int(tx.get("blockNumber", 0) or 0),
                        timestamp=ts,
                        value_native=value_eth,
                        value_usd=None,
                        fee_native=fee_eth,
                        direction=direction,
                        counterparty_addresses=[counterparty] if counterparty else [],
                        confirmations=int(tx.get("confirmations", 0) or 0),
                    )
                )

        all_times = [t.timestamp for t in txs if t.timestamp]
        first_seen = min(all_times) if all_times else None
        last_seen = max(all_times) if all_times else None

        in_total = sum(t.value_native for t in txs if t.direction == "in")
        out_total = sum(t.value_native for t in txs if t.direction == "out")

        risk_level, risk_signals = self._assess_risk(address, txs)

        return AddressProfile(
            address=address,
            network=CryptoNetwork.ETHEREUM,
            balance_native=balance_eth,
            balance_usd=None,
            total_received=in_total,
            total_sent=out_total,
            transaction_count=len(txs),
            first_seen=first_seen,
            last_seen=last_seen,
            transactions=txs,
            risk_level=risk_level,
            risk_signals=risk_signals,
            exchange_label=_lookup_exchange_label(address),
            cluster_addresses=[],
            queried_at=datetime.now(UTC),
            data_source="etherscan.io",
        )

    def _assess_risk(
        self,
        address: str,
        txs: list[Transaction],
    ) -> tuple[AddressRisk, list[str]]:
        """Heuristic ETH risk assessment."""
        signals = []

        risk_label = _lookup_risk_label(address)
        if risk_label:
            signals.append(f"Known high-risk: {risk_label}")
            return AddressRisk.CRITICAL, signals

        exchange_label = _lookup_exchange_label(address)
        if exchange_label:
            signals.append(f"Known exchange: {exchange_label}")
            return AddressRisk.LOW, signals

        if len(txs) > 1000:
            signals.append(f"Very high tx count ({len(txs)}) — possible contract/exchange")

        if signals:
            return AddressRisk.MEDIUM, signals
        return AddressRisk.CLEAN, []

# ---------------------------------------------------------------------------
# Main Crypto Tracer
# ---------------------------------------------------------------------------

class CryptoTracer:
    """
    Unified cryptocurrency address tracer.

    Supports Bitcoin (via Blockchain.info) and Ethereum (via Etherscan).
    Includes address extraction from text and heuristic risk scoring.
    """

    def __init__(
        self,
        etherscan_api_key: str | None = None,
        simulation_mode: bool = False,
    ):
        self.btc_tracer = BitcoinTracer()
        self.eth_tracer = EthereumTracer(api_key=etherscan_api_key)
        self.simulation_mode = simulation_mode

    async def trace_addresses(
        self,
        addresses: list[str],
        max_txs_per_address: int = 20,
    ) -> CryptoTraceResult:
        """
        Trace a list of cryptocurrency addresses.

        Args:
            addresses: List of crypto addresses (BTC, ETH, etc.)
            max_txs_per_address: Max transactions to fetch per address

        Returns:
            CryptoTraceResult with full profiles
        """
        start_time = time.time()
        scan_id = hashlib.md5(f"{''.join(addresses)}{time.time()}".encode()).hexdigest()[:12]

        profiles: list[AddressProfile] = []
        errors: list[str] = []
        network_summary: dict[str, int] = {}

        if self.simulation_mode:
            profiles = self._simulate_profiles(addresses)
        else:
            tasks = []
            for addr in addresses:
                network = classify_address_network(addr)
                network_summary[network.value] = network_summary.get(network.value, 0) + 1
                if network == CryptoNetwork.BITCOIN:
                    tasks.append(self._trace_btc(addr, max_txs_per_address, profiles, errors))
                elif network == CryptoNetwork.ETHEREUM:
                    tasks.append(self._trace_eth(addr, max_txs_per_address, profiles, errors))
                else:
                    errors.append(f"Unsupported network for address: {addr}")

            if tasks:
                await asyncio.gather(*tasks)

        total_usd = None  # Would need price API for conversion
        highest_risk = self._highest_risk(profiles)

        return CryptoTraceResult(
            scan_id=scan_id,
            addresses_queried=addresses,
            profiles=profiles,
            total_usd_value=total_usd,
            highest_risk=highest_risk,
            network_summary=network_summary,
            scan_duration_s=time.time() - start_time,
            scanned_at=datetime.now(UTC),
            errors=errors,
        )

    async def extract_and_trace(self, text: str, max_txs: int = 20) -> CryptoTraceResult:
        """Extract crypto addresses from text and trace them all."""
        found = detect_crypto_addresses(text)
        all_addresses = []
        for addr_list in found.values():
            all_addresses.extend(addr_list)
        all_addresses = list(dict.fromkeys(all_addresses))  # dedup

        if not all_addresses:
            return CryptoTraceResult(
                scan_id="empty",
                addresses_queried=[],
                profiles=[],
                total_usd_value=None,
                highest_risk=AddressRisk.CLEAN,
                network_summary={},
                scan_duration_s=0.0,
                scanned_at=datetime.now(UTC),
                errors=["No cryptocurrency addresses found in text"],
            )

        return await self.trace_addresses(all_addresses, max_txs)

    async def _trace_btc(
        self,
        address: str,
        max_txs: int,
        profiles: list[AddressProfile],
        errors: list[str],
    ):
        data, err = await self.btc_tracer.get_address(address, max_txs)
        if err:
            errors.append(f"BTC [{address[:12]}...]: {err}")
            profiles.append(
                AddressProfile(
                    address=address,
                    network=CryptoNetwork.BITCOIN,
                    balance_native=0,
                    balance_usd=None,
                    total_received=0,
                    total_sent=0,
                    transaction_count=0,
                    first_seen=None,
                    last_seen=None,
                    transactions=[],
                    risk_level=AddressRisk.CLEAN,
                    risk_signals=[],
                    exchange_label=None,
                    cluster_addresses=[],
                    queried_at=datetime.now(UTC),
                    data_source="blockchain.info",
                    error=err,
                )
            )
        else:
            profiles.append(self.btc_tracer.parse_address(data, address))

    async def _trace_eth(
        self,
        address: str,
        max_txs: int,
        profiles: list[AddressProfile],
        errors: list[str],
    ):
        data, err = await self.eth_tracer.get_address(address, max_txs)
        if err:
            errors.append(f"ETH [{address[:12]}...]: {err}")
            profiles.append(
                AddressProfile(
                    address=address,
                    network=CryptoNetwork.ETHEREUM,
                    balance_native=0,
                    balance_usd=None,
                    total_received=0,
                    total_sent=0,
                    transaction_count=0,
                    first_seen=None,
                    last_seen=None,
                    transactions=[],
                    risk_level=AddressRisk.CLEAN,
                    risk_signals=[],
                    exchange_label=None,
                    cluster_addresses=[],
                    queried_at=datetime.now(UTC),
                    data_source="etherscan.io",
                    error=err,
                )
            )
        else:
            profiles.append(self.eth_tracer.parse_address(data, address))

    def _highest_risk(self, profiles: list[AddressProfile]) -> AddressRisk:
        order = [
            AddressRisk.CRITICAL,
            AddressRisk.HIGH,
            AddressRisk.MEDIUM,
            AddressRisk.LOW,
            AddressRisk.CLEAN,
        ]
        for level in order:
            if any(p.risk_level == level for p in profiles):
                return level
        return AddressRisk.CLEAN

    def _simulate_profiles(self, addresses: list[str]) -> list[AddressProfile]:
        """Return simulated profiles for testing."""
        profiles = []
        for addr in addresses:
            network = classify_address_network(addr)
            profiles.append(
                AddressProfile(
                    address=addr,
                    network=network,
                    balance_native=0.5,
                    balance_usd=30000.0,
                    total_received=2.5,
                    total_sent=2.0,
                    transaction_count=15,
                    first_seen=datetime(2022, 1, 1, tzinfo=UTC),
                    last_seen=datetime(2024, 6, 15, tzinfo=UTC),
                    transactions=[],
                    risk_level=AddressRisk.LOW,
                    risk_signals=["[SIMULATION] No real data — simulation mode active"],
                    exchange_label=None,
                    cluster_addresses=[],
                    queried_at=datetime.now(UTC),
                    data_source="simulation",
                )
            )
        return profiles

# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_crypto_tracer_instance: CryptoTracer | None = None

def get_crypto_tracer(simulation_mode: bool = False) -> CryptoTracer:
    """Get or create the global CryptoTracer instance."""
    global _crypto_tracer_instance
    if _crypto_tracer_instance is None:
        _crypto_tracer_instance = CryptoTracer(
            etherscan_api_key=os.getenv("ETHERSCAN_API_KEY"),
            simulation_mode=simulation_mode,
        )
    return _crypto_tracer_instance
