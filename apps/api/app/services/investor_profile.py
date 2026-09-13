from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, InvestorThesis, PriorInvestment, Profile
from app.models.investor import (
    InvestorProfileState,
    PriorInvestmentItem,
    PriorInvestmentsRequest,
    PriorInvestmentsResponse,
    ThesisData,
    ThesisRequest,
    ThesisResponse,
)
from app.services.profile_lookup import get_role_profile


def _mark_onboarding_complete(profile: Profile) -> None:
    if profile.l1_completed_at is None:
        profile.l1_completed_at = datetime.now(UTC)
    profile.embedding_v += 1


async def _get_thesis(session: AsyncSession, profile: Profile) -> InvestorThesis | None:
    thesis: InvestorThesis | None = await session.scalar(
        select(InvestorThesis).where(InvestorThesis.profile_id == profile.id)
    )
    return thesis


async def _require_thesis(session: AsyncSession, profile: Profile) -> None:
    if await _get_thesis(session, profile) is None:
        raise ProblemError(
            status=409,
            slug="thesis-required",
            title="Thesis required",
            detail="Save your investment thesis before adding prior investments.",
        )


async def get_investor_state(session: AsyncSession, clerk_user_id: str) -> InvestorProfileState:
    profile = await get_role_profile(session, clerk_user_id, AppRole.INVESTOR)
    thesis = await _get_thesis(session, profile)
    investments = await session.scalars(
        select(PriorInvestment)
        .where(PriorInvestment.profile_id == profile.id)
        .order_by(PriorInvestment.year.desc(), PriorInvestment.created_at)
    )
    settings = profile.l1_data
    status = settings.get("prior_investments_status")
    crunchbase_url = settings.get("crunchbase_url")
    return InvestorProfileState(
        profile_id=profile.id,
        completed=profile.l1_completed_at is not None,
        thesis=ThesisData.model_validate(thesis, from_attributes=True) if thesis else None,
        prior_investments=[
            PriorInvestmentItem(
                company=item.company_name,
                sector=item.sector,
                stage=item.stage,
                cheque=item.cheque_inr,
                year=item.year,
                source=item.source,
            )
            for item in investments
        ],
        hide_cheque_amounts=bool(settings.get("hide_cheque_amounts", True)),
        crunchbase_url=crunchbase_url if isinstance(crunchbase_url, str) else None,
        prior_investments_status=status if status in ("added", "skipped") else None,
        banner_dismissed=bool(settings.get("prior_investments_banner_dismissed", False)),
    )


async def save_thesis(
    session: AsyncSession, clerk_user_id: str, payload: ThesisRequest
) -> ThesisResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.INVESTOR)
    values = payload.model_dump(mode="json")
    thesis_id = await session.scalar(
        insert(InvestorThesis)
        .values(profile_id=profile.id, **values)
        .on_conflict_do_update(index_elements=[InvestorThesis.profile_id], set_=values)
        .returning(InvestorThesis.id)
    )
    profile.embedding_v += 1
    await session.commit()
    return ThesisResponse(thesis_id=thesis_id)


async def save_prior_investments(
    session: AsyncSession, clerk_user_id: str, payload: PriorInvestmentsRequest
) -> PriorInvestmentsResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.INVESTOR)
    await _require_thesis(session, profile)

    await session.execute(
        delete(PriorInvestment).where(
            PriorInvestment.profile_id == profile.id, PriorInvestment.source == "manual"
        )
    )
    session.add_all(
        PriorInvestment(
            profile_id=profile.id,
            company_name=entry.company,
            sector=entry.sector.value,
            stage=entry.stage.value,
            cheque_inr=entry.cheque,
            year=entry.year,
            source="manual",
        )
        for entry in payload.entries
    )
    profile.l1_data = {
        **profile.l1_data,
        "prior_investments_status": "added",
        "hide_cheque_amounts": payload.hide_cheque_amounts,
        "crunchbase_url": payload.crunchbase_url,
    }
    _mark_onboarding_complete(profile)
    await session.commit()
    return PriorInvestmentsResponse(count=len(payload.entries))


async def skip_prior_investments(
    session: AsyncSession, clerk_user_id: str
) -> PriorInvestmentsResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.INVESTOR)
    await _require_thesis(session, profile)
    if profile.l1_data.get("prior_investments_status") != "added":
        profile.l1_data = {**profile.l1_data, "prior_investments_status": "skipped"}
    _mark_onboarding_complete(profile)
    await session.commit()
    return PriorInvestmentsResponse(count=0)


async def dismiss_prior_investments_banner(session: AsyncSession, clerk_user_id: str) -> None:
    profile = await get_role_profile(session, clerk_user_id, AppRole.INVESTOR)
    profile.l1_data = {**profile.l1_data, "prior_investments_banner_dismissed": True}
    await session.commit()
