from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.matches import MatchProfileCard


class IntroQueueItem(BaseModel):
    intro_id: UUID
    # The investor/mentor's own match row for this founder (links to Match Detail).
    match_id: UUID
    founder: MatchProfileCard
    sector: str
    message: str
    fit_score: float
    requested_at: datetime
