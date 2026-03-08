from __future__ import annotations

import os
import uuid
from datetime import datetime, UTC
from fastapi import Request, APIRouter, HTTPException
from app.models.crawl import ChatRequest, ChatResponse
from app.websocket.manager import manager
from app.config import get_clerk_config
from app.middleware.auth import verify_jwt_token
from app.models.auth import AuthenticatedUser

router = APIRouter(prefix="/api/chat", tags=["chat"])
from app.services.job_store import get_job_store  # noqa: E402

_chat_store = get_job_store("chat_sessions")


def utc_now():
    return datetime.now(UTC)


@router.post("/completions", response_model=ChatResponse)
async def chat_completion(request: ChatRequest, http_request: Request):
    """
    Get chat completion from LM Studio.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    user: AuthenticatedUser | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            http_request.state.user = user

    if user:
        http_request.state.user_id = user.user_id

    message_id = str(uuid.uuid4())

    initial_session = {
        "message_id": message_id,
        "role": "assistant",
        "content": "",
        "model": request.model,
        "finish_reason": None,
        "usage": None,
        "created_at": utc_now(),
    }
    await _chat_store.set(message_id, initial_session)

    await manager.send_chat_update(
        message_id,
        "processing",
        {
            "model": request.model,
            "stream": request.stream,
        },
    )

    try:
        from app.services.lm_studio_bridge import LMStudioBridge

        bridge = LMStudioBridge(
            base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1")
        )

        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        if request.stream:
            raise HTTPException(status_code=501, detail="Streaming not yet implemented")

        response = await bridge._make_request_with_retry(
            "/chat/completions",
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        content = ""
        finish_reason = "stop"
        usage = {}
        choices = response.get("choices", [])
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content", "")
            finish_reason = choices[0].get("finish_reason", "stop")
        usage = response.get("usage", {})

        await _chat_store.update(
            message_id,
            {
                "content": content,
                "finish_reason": finish_reason,
                "usage": usage,
            },
        )

        await manager.send_chat_update(
            message_id,
            "completed",
            {"finish_reason": finish_reason},
        )

        session = await _chat_store.get(message_id)
        return ChatResponse(**session)

    except Exception as e:
        await _chat_store.update(
            message_id,
            {
                "finish_reason": "error",
                "content": f"Error: {str(e)}",
            },
        )

        await manager.send_chat_update(message_id, "failed", {"error": str(e)})

        raise HTTPException(status_code=500, detail=f"LM Studio error: {str(e)}")


@router.get("/history/{message_id}", response_model=ChatResponse)
async def get_chat_message(message_id: str):
    if not await _chat_store.contains(message_id):
        raise HTTPException(status_code=404, detail="Chat message not found")

    session = await _chat_store.get(message_id)
    return ChatResponse(**session)


@router.get("/sessions")
async def list_sessions(limit: int = 100):
    sessions = await _chat_store.values()
    sessions = sorted(sessions, key=lambda x: x["created_at"], reverse=True)
    sessions = sessions[:limit]

    return [ChatResponse(**s) for s in sessions]


@router.post("/clear")
async def clear_sessions(http_request: Request):
    """
    Clear all chat sessions.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        verify_jwt_token(auth_header)  # Validate but don't store user

    count = await _chat_store.clear()

    return {"message": f"Cleared {count} chat sessions"}
