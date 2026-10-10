"""Minimal OpenID Connect client for SSO login (tested against Authentik, but works with any
standards-compliant provider). Deliberately does not verify the id_token's signature locally -
the code exchange and userinfo call both go directly server-to-server over TLS to the provider,
which is the standard trust model for a confidential client (the provider's response IS the
proof, same as the existing /auth/login trusting its own DB lookup over the same kind of
channel). This keeps the implementation to plain httpx calls instead of also pulling in JWKS
fetching/caching and JWT-signature verification for a guarantee the TLS channel already gives us.
"""

import time
from urllib.parse import urlencode

import httpx

from app.config import settings

_discovery_cache: dict | None = None
_discovery_cache_at: float = 0.0
_DISCOVERY_TTL_SECONDS = 3600


class OidcNotConfiguredError(Exception):
    pass


class OidcError(Exception):
    """A request to the provider failed, or it didn't return what we needed."""


def is_configured() -> bool:
    return bool(settings.oidc_issuer and settings.oidc_client_id and settings.oidc_client_secret)


async def _discovery() -> dict:
    global _discovery_cache, _discovery_cache_at
    if not is_configured():
        raise OidcNotConfiguredError("SSO (OIDC) ist nicht konfiguriert")
    now = time.monotonic()
    if _discovery_cache is not None and now - _discovery_cache_at < _DISCOVERY_TTL_SECONDS:
        return _discovery_cache
    url = settings.oidc_issuer.rstrip("/") + "/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise OidcError(f"OIDC-Discovery fehlgeschlagen ({url}): {exc}") from exc
    _discovery_cache = resp.json()
    _discovery_cache_at = now
    return _discovery_cache


async def build_authorize_url(redirect_uri: str, state: str) -> str:
    disco = await _discovery()
    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return disco["authorization_endpoint"] + "?" + urlencode(params)


async def exchange_code(code: str, redirect_uri: str) -> dict:
    disco = await _discovery()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            disco["token_endpoint"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": settings.oidc_client_id,
                "client_secret": settings.oidc_client_secret,
            },
            headers={"Accept": "application/json"},
        )
    if resp.status_code != 200:
        raise OidcError(f"Token-Austausch fehlgeschlagen ({resp.status_code}): {resp.text[:300]}")
    return resp.json()


async def fetch_userinfo(access_token: str) -> dict:
    disco = await _discovery()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            disco["userinfo_endpoint"], headers={"Authorization": f"Bearer {access_token}"}
        )
    if resp.status_code != 200:
        raise OidcError(f"Nutzerinfo konnte nicht geladen werden ({resp.status_code})")
    return resp.json()
