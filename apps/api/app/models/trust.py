from typing import Literal

from pydantic import BaseModel


class TrustResponse(BaseModel):
    # Null for new users (< 10 interactions) and profiles not scored yet (S7 AC4).
    badge: Literal["high", "medium", "low"] | None
    message: str | None
