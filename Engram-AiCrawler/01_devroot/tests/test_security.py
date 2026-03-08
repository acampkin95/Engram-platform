import pytest
from unittest.mock import patch, AsyncMock
from app.core.security import validate_url


class TestSSRFProtection:
    @pytest.mark.asyncio
    async def test_blocks_private_ip_10(self):
        with pytest.raises(ValueError, match="private IP"):
            await validate_url("http://10.0.0.1/secret")

    @pytest.mark.asyncio
    async def test_blocks_private_ip_192(self):
        with pytest.raises(ValueError, match="private IP"):
            await validate_url("http://192.168.1.1/admin")

    @pytest.mark.asyncio
    async def test_blocks_private_ip_172(self):
        with pytest.raises(ValueError, match="private IP"):
            await validate_url("http://172.16.0.1/internal")

    @pytest.mark.asyncio
    async def test_blocks_loopback(self):
        with pytest.raises(ValueError, match="private IP"):
            await validate_url("http://127.0.0.1/")

    @pytest.mark.asyncio
    async def test_blocks_localhost(self):
        with pytest.raises(ValueError, match="Blocked hostname"):
            await validate_url("http://localhost/admin")

    @pytest.mark.asyncio
    async def test_blocks_local_suffix(self):
        with pytest.raises(ValueError, match="Blocked hostname suffix"):
            await validate_url("http://myserver.local/")

    @pytest.mark.asyncio
    async def test_blocks_internal_suffix(self):
        with pytest.raises(ValueError, match="Blocked hostname suffix"):
            await validate_url("http://api.internal/")

    @pytest.mark.asyncio
    async def test_blocks_metadata_endpoint(self):
        with pytest.raises(ValueError, match="Blocked hostname"):
            await validate_url("http://metadata.google.internal/computeMetadata/v1/")

    @pytest.mark.asyncio
    async def test_blocks_file_scheme(self):
        with pytest.raises(ValueError, match="Malformed URL|Blocked URL scheme"):
            await validate_url("file:///etc/passwd")

    @pytest.mark.asyncio
    async def test_blocks_ftp_scheme(self):
        with pytest.raises(ValueError, match="Blocked URL scheme"):
            await validate_url("ftp://evil.com/payload")

    @pytest.mark.asyncio
    async def test_blocks_gopher_scheme(self):
        with pytest.raises(ValueError, match="Blocked URL scheme"):
            await validate_url("gopher://evil.com/")

    @pytest.mark.asyncio
    async def test_blocks_data_scheme(self):
        with pytest.raises(ValueError, match="Malformed URL|Only HTTP/HTTPS"):
            await validate_url("data:text/html,<script>alert(1)</script>")

    @pytest.mark.asyncio
    async def test_blocks_malformed_url(self):
        with pytest.raises(ValueError, match="Malformed URL"):
            await validate_url("not-a-url")

    @pytest.mark.asyncio
    async def test_allows_valid_https(self):
        with patch("app.core.security.asyncio.to_thread", new_callable=AsyncMock) as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
            result = await validate_url("https://example.com")
            assert result is True

    @pytest.mark.asyncio
    async def test_allows_valid_http(self):
        with patch("app.core.security.asyncio.to_thread", new_callable=AsyncMock) as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 80))]
            result = await validate_url("http://example.com")
            assert result is True

    @pytest.mark.asyncio
    async def test_blocks_dns_resolving_to_private(self):
        with patch("app.core.security.asyncio.to_thread", new_callable=AsyncMock) as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("127.0.0.1", 80))]
            with pytest.raises(ValueError, match="resolves to private IP"):
                await validate_url("http://evil-redirect.com/")

    @pytest.mark.asyncio
    async def test_blocks_ipv6_loopback(self):
        with pytest.raises(ValueError, match="private IP"):
            await validate_url("http://[::1]/admin")

    @pytest.mark.asyncio
    async def test_allows_github(self):
        with patch("app.core.security.asyncio.to_thread", new_callable=AsyncMock) as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("140.82.121.3", 443))]
            result = await validate_url("https://github.com")
            assert result is True

    @pytest.mark.asyncio
    async def test_blocks_link_local_ip(self):
        with pytest.raises(ValueError, match="private IP|Blocked hostname"):
            await validate_url("http://169.254.169.254/latest/meta-data/")
