from app.models.matches import MatchProfileCard
from app.models.taxonomy import AVAILABILITY_LABELS, GEOGRAPHY_LABELS, STAGE_LABELS
from app.services.match_scoring import format_inr
from app.services.profile_snapshots import ProfileSnapshot


def profile_card(snapshot: ProfileSnapshot) -> MatchProfileCard:
    if snapshot.founder is not None:
        founder = snapshot.founder
        stage = STAGE_LABELS[founder.stage.value]
        return MatchProfileCard(
            profile_id=snapshot.profile_id,
            kind="founder",
            display_name=snapshot.display_name or founder.startup_name,
            headline=f"{founder.startup_name} · {founder.sector.value} · {stage}",
            location=founder.city,
            bio=snapshot.bio or founder.description,
            facts=[
                f"Raising {format_inr(founder.ask_amount_inr)}",
                founder.business_model.value,
                f"Team of {founder.team_size}",
            ],
        )
    if snapshot.thesis is not None:
        thesis = snapshot.thesis
        facts = [", ".join(STAGE_LABELS[stage.value] for stage in thesis.stages)]
        if thesis.cheque_min is not None and thesis.cheque_max is not None:
            low, high = format_inr(thesis.cheque_min), format_inr(thesis.cheque_max)
            facts.insert(0, f"{low} to {high} cheque")
        return MatchProfileCard(
            profile_id=snapshot.profile_id,
            kind="investor",
            display_name=snapshot.display_name or "Investor",
            headline=f"Investor · {' & '.join(sector.value for sector in thesis.sectors[:2])}",
            location=", ".join(GEOGRAPHY_LABELS[geo] for geo in thesis.geographies[:3]),
            bio=snapshot.bio,
            facts=facts,
        )
    expertise = snapshot.expertise
    areas = expertise.areas if expertise is not None else []
    return MatchProfileCard(
        profile_id=snapshot.profile_id,
        kind="mentor",
        display_name=snapshot.display_name or "Mentor",
        headline=f"Mentor · {' & '.join(area.value for area in areas[:2])}",
        location=None,
        bio=snapshot.bio,
        facts=(
            [
                AVAILABILITY_LABELS[expertise.availability],
                f"{format_inr(expertise.session_fee)} / session"
                if expertise.session_fee
                else "Free sessions",
            ]
            if expertise is not None
            else []
        ),
    )
