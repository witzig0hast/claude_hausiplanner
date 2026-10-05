"""Thin client for the OwnAI Agent Bus (https://github.com/witzig0hast/ownai,
backend/app/api/agent_bus.py) - lets this project exchange messages/tasks peer-to-peer with the
user's other self-hosted projects via a central hub, authenticated only via the X-Agent-Key
header (no relation to this app's own user JWTs).

Endpoint contract (read from the OwnAI source, not guessed):
  GET  {base}/agent-bus/inbox                     -> {"messages": [...]}  (full history, every
                                                       call - no "unread" filter or pagination)
  POST {base}/agent-bus/messages/{id}/result       <- {"status": "completed"|"failed",
                                                         "result": {...} | null}
  POST {base}/agent-bus/messages                   <- {"to", "kind", "content"?, "task_type"?,
                                                         "payload"?}
Every call never raises outward - mirrors the push/email services: a bus outage must never break
the feature that happened to trigger it.
"""

from typing import Any

import httpx

from app.config import settings


class AgentBusUnavailableError(Exception):
    """The bus isn't configured, or a request to it failed."""


def is_configured() -> bool:
    return bool(settings.ownai_agent_bus_key)


def _headers() -> dict[str, str]:
    return {"X-Agent-Key": settings.ownai_agent_bus_key or ""}


async def fetch_inbox() -> list[dict[str, Any]]:
    if not is_configured():
        raise AgentBusUnavailableError("OWNAI_AGENT_BUS_KEY ist nicht konfiguriert")
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(f"{settings.ownai_agent_bus_base_url}/agent-bus/inbox", headers=_headers())
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Agent Bus nicht erreichbar: {exc}") from exc
    return resp.json().get("messages", [])


async def submit_result(message_id: str, status: str, result: dict[str, Any] | None) -> dict[str, Any]:
    if not is_configured():
        raise AgentBusUnavailableError("OWNAI_AGENT_BUS_KEY ist nicht konfiguriert")
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ownai_agent_bus_base_url}/agent-bus/messages/{message_id}/result",
                headers=_headers(),
                json={"status": status, "result": result},
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Ergebnis konnte nicht gemeldet werden: {exc}") from exc
    return resp.json()


async def send_message(
    to: str,
    kind: str,
    *,
    content: str | None = None,
    task_type: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """`to` is "ownai" (triggers a push to the account owner) or another registered project's
    name. Exactly one of content (kind="text") / task_type (kind="task") must be set."""
    if not is_configured():
        raise AgentBusUnavailableError("OWNAI_AGENT_BUS_KEY ist nicht konfiguriert")
    body: dict[str, Any] = {"to": to, "kind": kind}
    if content is not None:
        body["content"] = content
    if task_type is not None:
        body["task_type"] = task_type
    if payload is not None:
        body["payload"] = payload

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ownai_agent_bus_base_url}/agent-bus/messages", headers=_headers(), json=body
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Nachricht konnte nicht gesendet werden: {exc}") from exc
    return resp.json()
