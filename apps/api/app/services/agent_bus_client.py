"""Thin client for the OwnAI Agent Bus (https://github.com/witzig0hast/ownai,
backend/app/api/agent_bus.py) - lets any user of this project exchange messages/tasks
peer-to-peer with their own other self-hosted projects via a central hub, authenticated only via
the X-Agent-Key header (no relation to this app's own user JWTs). Each user connects their own
OwnAI account, so every call takes that user's own base_url/api_key explicitly rather than
reading a single global config.

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


class AgentBusUnavailableError(Exception):
    """A request to the bus failed."""


def _headers(api_key: str) -> dict[str, str]:
    return {"X-Agent-Key": api_key}


async def fetch_inbox(base_url: str, api_key: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(f"{base_url}/agent-bus/inbox", headers=_headers(api_key))
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Agent Bus nicht erreichbar: {exc}") from exc
    return resp.json().get("messages", [])


async def submit_result(
    base_url: str, api_key: str, message_id: str, status: str, result: dict[str, Any] | None
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{base_url}/agent-bus/messages/{message_id}/result",
                headers=_headers(api_key),
                json={"status": status, "result": result},
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Ergebnis konnte nicht gemeldet werden: {exc}") from exc
    return resp.json()


async def send_message(
    base_url: str,
    api_key: str,
    to: str,
    kind: str,
    *,
    content: str | None = None,
    task_type: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """`to` is "ownai" (triggers a push to the account owner) or another registered project's
    name. Exactly one of content (kind="text") / task_type (kind="task") must be set."""
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
                f"{base_url}/agent-bus/messages", headers=_headers(api_key), json=body
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AgentBusUnavailableError(f"Nachricht konnte nicht gesendet werden: {exc}") from exc
    return resp.json()
