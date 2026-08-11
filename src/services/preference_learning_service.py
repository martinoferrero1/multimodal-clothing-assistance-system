from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime

from core.metaclasses.singleton_meta import SingletonMeta
from infra.db.models.chat_models import ChatUser, UserPreferenceAggregate, UserPreferenceSignal
from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpec, ItemSpecList, OutfitSpec
from services.style_preferences_service import get_style_preferences_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


REQUEST_SIGNAL_STRENGTH = {
    "usage": 0.35,
    "max_price": 0.25,
    "gender": 0.25,
    "brands": 0.40,
    "seasons": 0.25,
    "base_colors": 0.35,
    "secondary_colors": 0.25,
    "master_categories": 0.30,
    "sub_categories": 0.30,
    "article_types": 0.30,
}
EXPLICIT_SIGNAL_STRENGTH = 0.90
CORRECTION_SIGNAL_STRENGTH = 0.65
PROMOTION_MIN_CONFIDENCE = 0.58
MAX_LEARNED_PREFERENCES = 12

COLOR_ALIASES = {
    "black": "Black",
    "negro": "Black",
    "negra": "Black",
    "white": "White",
    "blanco": "White",
    "blanca": "White",
    "red": "Red",
    "rojo": "Red",
    "roja": "Red",
    "blue": "Blue",
    "azul": "Blue",
    "green": "Green",
    "verde": "Green",
    "yellow": "Yellow",
    "amarillo": "Yellow",
    "amarilla": "Yellow",
    "pink": "Pink",
    "rosa": "Pink",
    "brown": "Brown",
    "marron": "Brown",
    "marrón": "Brown",
    "grey": "Grey",
    "gray": "Grey",
    "gris": "Grey",
    "orange": "Orange",
    "naranja": "Orange",
    "purple": "Purple",
    "violeta": "Purple",
    "morado": "Purple",
    "morada": "Purple",
    "beige": "Beige",
    "cream": "Cream",
    "crema": "Cream",
    "gold": "Gold",
    "dorado": "Gold",
    "dorada": "Gold",
    "silver": "Silver",
    "plateado": "Silver",
    "plateada": "Silver",
    "navy": "Navy",
}
STYLE_ALIASES = {
    "minimalist": "Minimalist",
    "minimalista": "Minimalist",
    "casual": "Casual",
    "formal": "Formal",
    "sporty": "Sporty",
    "deportivo": "Sporty",
    "deportiva": "Sporty",
    "elegant": "Elegant",
    "elegante": "Elegant",
    "urban": "Urban",
    "urbano": "Urban",
    "urbana": "Urban",
    "classic": "Classic",
    "clasico": "Classic",
    "clasica": "Classic",
    "clásico": "Classic",
    "clásica": "Classic",
    "oversize": "Oversize",
    "oversized": "Oversize",
}
BRAND_ALIASES = {
    "nike": "Nike",
    "adidas": "Adidas",
    "puma": "Puma",
    "reebok": "Reebok",
    "zara": "Zara",
    "h&m": "H&M",
    "hm": "H&M",
    "levis": "Levi's",
    "levi's": "Levi's",
    "gucci": "Gucci",
}
THIRD_PARTY_MARKERS = (
    "gift",
    "regalo",
    "for my friend",
    "for my mother",
    "for my father",
    "for my wife",
    "for my husband",
    "for my girlfriend",
    "for my boyfriend",
    "para mi amigo",
    "para mi amiga",
    "para mi madre",
    "para mi padre",
    "para mi esposa",
    "para mi marido",
    "para mi novio",
    "para mi novia",
)
POSITIVE_PATTERNS = (
    re.compile(r"\b(?:i\s+(?:like|love|prefer)|me\s+(?:gusta|gustan|encanta|encantan)|prefiero)\b(?P<tail>[^.?!;]{1,90})", re.IGNORECASE),
    re.compile(r"\b(?:suelo\s+(?:usar|buscar|comprar)|usually\s+(?:wear|search|buy))\b(?P<tail>[^.?!;]{1,90})", re.IGNORECASE),
)
NEGATIVE_PATTERNS = (
    re.compile(r"\b(?:i\s+(?:do\s+not|don't|dislike|hate)|no\s+me\s+(?:gusta|gustan)|odio|evito)\b(?P<tail>[^.?!;]{1,90})", re.IGNORECASE),
)
CORRECTION_PATTERNS = (
    re.compile(r"\b(?:make\s+it|mejor|instead|en\s+vez\s+de)\b(?P<tail>[^.?!;]{1,70})", re.IGNORECASE),
)


@dataclass(frozen=True)
class PreferenceSignalCandidate:
    field: str
    value: str
    polarity: str
    source: str
    strength: float
    evidence: str


class PreferenceLearningService(metaclass=SingletonMeta):
    async def record_turn(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        conversation_id: str,
        message_id: str,
        message_content: str,
        request: ItemSpecList | None,
        learning_enabled: bool,
    ) -> None:
        if not learning_enabled:
            return

        observed_at = datetime.now(UTC)
        candidates = self.detect_signals(message_content, request)
        if not candidates:
            return

        seen: set[tuple[str, str, str]] = set()
        for candidate in candidates:
            normalized_value = self._normalize_key(candidate.value)
            key = (candidate.field, normalized_value, candidate.polarity)
            if key in seen:
                continue
            seen.add(key)
            session.add(
                UserPreferenceSignal(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    field=candidate.field,
                    value=candidate.value,
                    normalized_value=normalized_value,
                    polarity=candidate.polarity,
                    source=candidate.source,
                    strength=candidate.strength,
                    evidence=candidate.evidence,
                    observed_at=observed_at,
                )
            )
            await self._update_aggregate(session, user_id, candidate, normalized_value, observed_at)

        await session.flush()
        await self._sync_user_inferred_preferences(session, user_id)

    def detect_signals(
        self,
        message_content: str,
        request: ItemSpecList | None,
    ) -> list[PreferenceSignalCandidate]:
        candidates: list[PreferenceSignalCandidate] = []
        third_party = self._has_third_party_context(message_content)
        request_strength_multiplier = 0.35 if third_party else 1.0
        if not third_party:
            candidates.extend(self._signals_from_explicit_language(message_content))
        candidates.extend(self._signals_from_request(request, request_strength_multiplier))
        return candidates

    async def suppress_inferred_preference(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        raw_preferences: dict | None,
        inferred_id: str,
    ) -> None:
        preferences = get_style_preferences_service().user_preferences(raw_preferences)
        inferred = next((entry for entry in preferences.inferred if entry.id == inferred_id), None)
        if inferred is None or inferred.source != "learned" or not inferred.aggregate_id:
            return

        aggregate = await session.get(UserPreferenceAggregate, inferred.aggregate_id)
        if aggregate is None or aggregate.user_id != user_id:
            return
        aggregate.suppressed = True
        aggregate.suppressed_at = datetime.now(UTC)
        session.add(aggregate)

    def _signals_from_request(
        self,
        request: ItemSpecList | None,
        strength_multiplier: float,
    ) -> list[PreferenceSignalCandidate]:
        if request is None:
            return []

        candidates: list[PreferenceSignalCandidate] = []
        for item in request.items:
            candidates.extend(self._signals_from_item(item, strength_multiplier))
        return candidates

    def _signals_from_item(
        self,
        item: ItemSpec,
        strength_multiplier: float,
    ) -> list[PreferenceSignalCandidate]:
        candidates: list[PreferenceSignalCandidate] = []
        if isinstance(item, OutfitSpec):
            candidates.extend(self._signals_from_garment_fields(item, strength_multiplier, "outfit request"))
            for garment in item.items:
                candidates.extend(self._signals_from_garment_fields(garment, strength_multiplier, "garment request"))
            return candidates
        return self._signals_from_garment_fields(item, strength_multiplier, "garment request")

    def _signals_from_garment_fields(
        self,
        item: GarmentSpec | OutfitSpec,
        strength_multiplier: float,
        source_label: str,
    ) -> list[PreferenceSignalCandidate]:
        candidates: list[PreferenceSignalCandidate] = []
        values_by_field = {
            "usage": [item.usage] if item.usage else [],
            "max_price": [self._format_price(item.max_price)] if item.max_price is not None else [],
            "gender": [item.gender] if item.gender else [],
            "brands": item.brands or [],
            "seasons": item.seasons or [],
            "base_colors": item.base_colors or [],
            "secondary_colors": item.secondary_colors or [],
        }
        if isinstance(item, GarmentSpec):
            values_by_field.update(
                {
                    "master_categories": item.master_categories or [],
                    "sub_categories": item.sub_categories or [],
                    "article_types": item.article_types or [],
                }
            )

        for field, values in values_by_field.items():
            strength = REQUEST_SIGNAL_STRENGTH[field] * strength_multiplier
            if strength < 0.15:
                continue
            for value in values:
                cleaned = self._clean_value(value, field)
                if not cleaned:
                    continue
                candidates.append(
                    PreferenceSignalCandidate(
                        field=field,
                        value=cleaned,
                        polarity="positive",
                        source="request_field",
                        strength=strength,
                        evidence=f"Observed in {source_label}: {field} = {cleaned}.",
                    )
                )
        return candidates

    def _signals_from_explicit_language(self, message_content: str) -> list[PreferenceSignalCandidate]:
        candidates: list[PreferenceSignalCandidate] = []
        for pattern in POSITIVE_PATTERNS:
            for match in pattern.finditer(message_content):
                candidates.extend(self._signals_from_phrase_tail(match.group("tail"), "positive", EXPLICIT_SIGNAL_STRENGTH))
        for pattern in NEGATIVE_PATTERNS:
            for match in pattern.finditer(message_content):
                candidates.extend(self._signals_from_phrase_tail(match.group("tail"), "negative", EXPLICIT_SIGNAL_STRENGTH))
        for pattern in CORRECTION_PATTERNS:
            for match in pattern.finditer(message_content):
                candidates.extend(self._signals_from_phrase_tail(match.group("tail"), "positive", CORRECTION_SIGNAL_STRENGTH, "correction"))
        return candidates

    def _signals_from_phrase_tail(
        self,
        tail: str,
        polarity: str,
        strength: float,
        source: str = "explicit_statement",
    ) -> list[PreferenceSignalCandidate]:
        normalized_tail = self._normalize_key(tail)
        evidence = tail.strip()[:140]
        candidates: list[PreferenceSignalCandidate] = []
        candidates.extend(self._alias_signals(normalized_tail, COLOR_ALIASES, "base_colors", polarity, strength, source, evidence))
        candidates.extend(self._alias_signals(normalized_tail, BRAND_ALIASES, "brands", polarity, strength, source, evidence))
        candidates.extend(self._alias_signals(normalized_tail, STYLE_ALIASES, "liked_styles", polarity, strength, source, evidence))
        return candidates

    def _alias_signals(
        self,
        normalized_tail: str,
        aliases: dict[str, str],
        field: str,
        polarity: str,
        strength: float,
        source: str,
        evidence: str,
    ) -> list[PreferenceSignalCandidate]:
        signals: list[PreferenceSignalCandidate] = []
        for alias, canonical in aliases.items():
            if re.search(rf"(?:^|\W){re.escape(self._normalize_key(alias))}(?:\W|$)", normalized_tail):
                signals.append(
                    PreferenceSignalCandidate(
                        field=field,
                        value=canonical,
                        polarity=polarity,
                        source=source,
                        strength=strength,
                        evidence=f"Explicit preference phrase: {evidence}.",
                    )
                )
        return signals

    async def _update_aggregate(
        self,
        session: AsyncSession,
        user_id: str,
        candidate: PreferenceSignalCandidate,
        normalized_value: str,
        observed_at: datetime,
    ) -> None:
        aggregate = await session.scalar(
            select(UserPreferenceAggregate).where(
                UserPreferenceAggregate.user_id == user_id,
                UserPreferenceAggregate.field == candidate.field,
                UserPreferenceAggregate.normalized_value == normalized_value,
                UserPreferenceAggregate.polarity == candidate.polarity,
            )
        )
        if aggregate is None:
            aggregate = UserPreferenceAggregate(
                user_id=user_id,
                field=candidate.field,
                value=candidate.value,
                normalized_value=normalized_value,
                polarity=candidate.polarity,
                observation_count=0,
                weighted_score=0.0,
                recent_score=0.0,
                confidence=0.0,
                first_seen_at=observed_at,
            )
        aggregate.value = candidate.value
        aggregate.observation_count += 1
        aggregate.weighted_score += candidate.strength
        aggregate.last_seen_at = observed_at
        aggregate.evidence = candidate.evidence
        aggregate.recent_score = self._recent_score(aggregate.weighted_score, aggregate.last_seen_at, observed_at)
        opposite = await self._opposite_aggregate(session, aggregate)
        aggregate.confidence = self._confidence(aggregate, opposite)
        if opposite is not None:
            opposite.confidence = self._confidence(opposite, aggregate)
            session.add(opposite)
        session.add(aggregate)

    async def _opposite_aggregate(
        self,
        session: AsyncSession,
        aggregate: UserPreferenceAggregate,
    ) -> UserPreferenceAggregate | None:
        opposite_polarity = "negative" if aggregate.polarity == "positive" else "positive"
        return await session.scalar(
            select(UserPreferenceAggregate).where(
                UserPreferenceAggregate.user_id == aggregate.user_id,
                UserPreferenceAggregate.field == aggregate.field,
                UserPreferenceAggregate.normalized_value == aggregate.normalized_value,
                UserPreferenceAggregate.polarity == opposite_polarity,
            )
        )

    async def _sync_user_inferred_preferences(self, session: AsyncSession, user_id: str) -> None:
        user = await session.get(ChatUser, user_id)
        if user is None:
            return

        current = get_style_preferences_service().user_preferences(user.style_preferences)
        manual_inferred = [entry for entry in current.inferred if entry.source != "learned"]
        aggregates = list(
            (
                await session.scalars(
                    select(UserPreferenceAggregate).where(
                        UserPreferenceAggregate.user_id == user_id,
                        UserPreferenceAggregate.suppressed == False,  # noqa: E712
                    )
                )
            ).all()
        )
        promoted = [aggregate for aggregate in aggregates if self._is_promoted(aggregate)]
        promoted.sort(key=lambda item: (item.confidence, item.recent_score, item.observation_count), reverse=True)

        learned_entries = [self._aggregate_to_inferred_storage(aggregate) for aggregate in promoted[:MAX_LEARNED_PREFERENCES]]
        user.style_preferences = {
            "use_personalized_styles": current.use_personalized_styles,
            "explicit": current.explicit.model_dump(mode="json"),
            "inferred": [entry.model_dump(mode="json") for entry in manual_inferred] + learned_entries,
        }
        session.add(user)

    def _aggregate_to_inferred_storage(self, aggregate: UserPreferenceAggregate) -> dict:
        updated_at = self._iso_or_none(aggregate.last_seen_at) or datetime.now(UTC).isoformat()
        return {
            "id": f"learned:{aggregate.id}",
            "kind": self._kind_for_aggregate(aggregate),
            "value": aggregate.value,
            "confidence": max(0.0, min(1.0, aggregate.confidence)),
            "evidence": aggregate.evidence,
            "created_at": self._iso_or_none(aggregate.first_seen_at),
            "updated_at": updated_at,
            "source": "learned",
            "field": aggregate.field,
            "polarity": aggregate.polarity,
            "occurrence_count": aggregate.observation_count,
            "first_seen_at": self._iso_or_none(aggregate.first_seen_at),
            "last_seen_at": self._iso_or_none(aggregate.last_seen_at),
            "score": round(aggregate.recent_score, 4),
            "aggregate_id": aggregate.id,
        }

    def _kind_for_aggregate(self, aggregate: UserPreferenceAggregate) -> str:
        prefix = "avoided" if aggregate.polarity == "negative" else "preferred"
        if aggregate.field in ("base_colors", "secondary_colors"):
            return f"{prefix}_color"
        if aggregate.field == "brands":
            return f"{prefix}_brand"
        if aggregate.field == "liked_styles":
            return "disliked_style" if aggregate.polarity == "negative" else "liked_style"
        return f"{prefix}_{aggregate.field.rstrip('s')}"

    def _is_promoted(self, aggregate: UserPreferenceAggregate) -> bool:
        if aggregate.suppressed:
            return False
        return (
            aggregate.confidence >= PROMOTION_MIN_CONFIDENCE
            and (aggregate.observation_count >= 3 or aggregate.weighted_score >= EXPLICIT_SIGNAL_STRENGTH)
        )

    def _confidence(
        self,
        aggregate: UserPreferenceAggregate,
        opposite: UserPreferenceAggregate | None,
    ) -> float:
        frequency = math.log1p(max(0, aggregate.observation_count)) * 0.18
        weighted = max(0.0, aggregate.weighted_score) * 0.32
        recency = aggregate.recent_score * 0.18
        contradiction = (opposite.recent_score * 0.30) if opposite is not None else 0.0
        return round(max(0.0, min(0.95, 0.12 + frequency + weighted + recency - contradiction)), 4)

    def _recent_score(
        self,
        weighted_score: float,
        last_seen_at: datetime | None,
        now: datetime,
    ) -> float:
        if last_seen_at is None:
            return 0.0
        days = max(0.0, (now - self._as_aware(last_seen_at)).total_seconds() / 86400)
        return round(weighted_score * math.exp(-days / 45), 4)

    def _clean_value(self, value: object, field: str) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        if field in ("base_colors", "secondary_colors"):
            return COLOR_ALIASES.get(self._normalize_key(normalized), normalized)
        return normalized

    def _format_price(self, value: float | None) -> str | None:
        if value is None:
            return None
        return str(int(value)) if float(value).is_integer() else f"{value:.2f}"

    def _has_third_party_context(self, message_content: str) -> bool:
        normalized = self._normalize_key(message_content)
        return any(marker in normalized for marker in THIRD_PARTY_MARKERS)

    def _normalize_key(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
        return re.sub(r"\s+", " ", ascii_value.casefold()).strip()

    def _as_aware(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

    def _iso_or_none(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return self._as_aware(value).isoformat()


def get_preference_learning_service() -> PreferenceLearningService:
    return PreferenceLearningService()
