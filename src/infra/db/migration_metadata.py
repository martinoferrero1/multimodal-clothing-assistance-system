from __future__ import annotations

from infra.db.models.base import Base
import infra.db.models.catalog_models  # noqa: F401
import infra.db.models.chat_models  # noqa: F401


application_metadata = Base.metadata
