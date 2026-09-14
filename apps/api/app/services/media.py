"""Validates and re-encodes uploaded post images (strips EXIF/GPS metadata, makes thumbnails)."""

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_EDGE = 2048
THUMBNAIL_EDGE = 640
# Decompression-bomb guard: Pillow raises for images over twice this many pixels.
Image.MAX_IMAGE_PIXELS = 20_000_000

FORMATS: dict[str, tuple[str, str]] = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


class InvalidImageError(Exception):
    pass


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int
    thumbnail: bytes


def _encode(image: Image.Image, image_format: str) -> bytes:
    buffer = BytesIO()
    if image_format == "JPEG":
        image.convert("RGB").save(buffer, "JPEG", quality=85, optimize=True)
    elif image_format == "PNG":
        image.save(buffer, "PNG", optimize=True)
    else:
        image.save(buffer, "WEBP", quality=85)
    return buffer.getvalue()


def process_image(data: bytes) -> ProcessedImage:
    """CPU-bound: call through asyncio.to_thread."""
    try:
        with Image.open(BytesIO(data)) as probe:
            image_format = probe.format or ""
            probe.verify()
        if image_format not in FORMATS:
            raise InvalidImageError(f"Unsupported format {image_format!r}")
        with Image.open(BytesIO(data)) as opened:
            opened.load()
            image = ImageOps.exif_transpose(opened) or opened.copy()
    except InvalidImageError:
        raise
    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        SyntaxError,
        ValueError,
    ) as exc:
        raise InvalidImageError("Unreadable image") from exc

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if image.mode in ("P", "LA", "PA") else "RGB")
    image.thumbnail((MAX_EDGE, MAX_EDGE))
    # Re-encoding writes pixels only, so EXIF (including GPS location) is dropped.
    full = _encode(image, image_format)
    thumbnail_image = image.copy()
    thumbnail_image.thumbnail((THUMBNAIL_EDGE, THUMBNAIL_EDGE))
    content_type, extension = FORMATS[image_format]
    return ProcessedImage(
        data=full,
        content_type=content_type,
        extension=extension,
        width=image.width,
        height=image.height,
        thumbnail=_encode(thumbnail_image, "WEBP"),
    )
