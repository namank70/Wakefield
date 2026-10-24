from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from .engine import WakefieldService
from .models import Issue
from .repository import InMemoryWakefieldRepository


def reset_demo(service: WakefieldService) -> dict:
    service.repository.reset_demo()
    service.repository.get_region("MLK_LIBRARY").baseline_activation_score = 1
    return {"campus_id": "SJSU", "region_id": "MLK_LIBRARY", "baseline_activation_score": 1, "health": 100, "issues": 0, "credits": 0}


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Reset Wakefield's isolated in-memory demo namespace")
    parser.parse_args()
    service = WakefieldService(InMemoryWakefieldRepository())
    print(reset_demo(service))


if __name__ == "__main__":
    asyncio.run(_main())

