import asyncio
import io
from dataclasses import dataclass

from pypdf import PasswordType, PdfReader

from app.errors import ProblemError

MIN_TEXT_CHARS = 200


@dataclass(frozen=True)
class DeckText:
    text: str
    pages: int


def _unreadable(detail: str) -> ProblemError:
    return ProblemError(status=422, slug="deck-unreadable", title="Unreadable deck", detail=detail)


def _extract_text(data: bytes) -> DeckText:
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted and reader.decrypt("") == PasswordType.NOT_DECRYPTED:
        raise _unreadable(
            "This PDF is password-protected. Remove the password and upload it again."
        )

    sections: list[str] = []
    for number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            sections.append(f"[Page {number}]\n{text}")
    return DeckText(text="\n\n".join(sections), pages=len(reader.pages))


async def read_deck(data: bytes) -> DeckText:
    if b"%PDF-" not in data[:1024]:
        raise _unreadable("That file isn't a valid PDF. Export your deck as a PDF and try again.")
    try:
        deck = await asyncio.to_thread(_extract_text, data)
    except ProblemError:
        raise
    except Exception as exc:  # pypdf raises many unrelated error types on malformed files
        raise _unreadable(
            "We couldn't read this PDF. It may be corrupted; export it again and retry."
        ) from exc

    if len(deck.text) < MIN_TEXT_CHARS:
        raise ProblemError(
            status=422,
            slug="deck-no-text",
            title="No readable text",
            detail="We couldn't find readable text in this deck. It may be made of images.",
        )
    return deck
