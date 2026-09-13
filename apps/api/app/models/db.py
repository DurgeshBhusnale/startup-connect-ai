import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class AppRole(StrEnum):
    FOUNDER = "founder"
    INVESTOR = "investor"
    MENTOR = "mentor"


class ConsentScope(StrEnum):
    TERMS_PRIVACY = "terms_privacy"
    MATCH_PROCESSING = "match_processing"
    EMAIL_NOTIFICATIONS = "email_notifications"
    WHATSAPP_NOTIFICATIONS = "whatsapp_notifications"


def _pg_enum(enum_cls: type[StrEnum], name: str) -> ENUM:
    # Types are created by Supabase migrations, never by SQLAlchemy.
    return ENUM(
        enum_cls,
        name=name,
        create_type=False,
        values_callable=lambda members: [member.value for member in members],
    )


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    clerk_id: Mapped[str] = mapped_column(Text, unique=True)
    role: Mapped[AppRole | None] = mapped_column(_pg_enum(AppRole, "app_role"))
    email: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[AppRole] = mapped_column(_pg_enum(AppRole, "app_role"))
    l1_data: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    ask_pin: Mapped[str | None] = mapped_column(Text)
    embedding_v: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    l1_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConsentLog(Base):
    __tablename__ = "consent_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    scope: Mapped[ConsentScope] = mapped_column(_pg_enum(ConsentScope, "consent_scope"))
    granted: Mapped[bool] = mapped_column(Boolean)
    policy_version: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
