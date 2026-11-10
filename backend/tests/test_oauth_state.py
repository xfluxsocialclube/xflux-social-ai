from datetime import datetime, timedelta, timezone
import sqlite3

import pytest

from app.oauth_state import consume_oauth_state, ensure_oauth_state_table, issue_oauth_state


@pytest.fixture
def db():
    connection = sqlite3.connect(":memory:", isolation_level=None)
    connection.row_factory = sqlite3.Row
    ensure_oauth_state_table(connection)
    yield connection
    connection.close()


def test_state_is_random_and_only_hash_is_stored(db):
    now = datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
    first = issue_oauth_state(db, network="instagram", session_subject="session-1", now=now)
    second = issue_oauth_state(db, network="instagram", session_subject="session-1", now=now)
    assert first != second
    rows = db.execute("SELECT state_hash FROM oauth_states").fetchall()
    assert len(rows) == 2
    assert first not in [row["state_hash"] for row in rows]


def test_state_is_consumed_once(db):
    now = datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
    state = issue_oauth_state(db, network="instagram", session_subject="session-1", now=now)
    assert consume_oauth_state(db, state=state, network="instagram", session_subject="session-1", now=now)
    assert not consume_oauth_state(db, state=state, network="instagram", session_subject="session-1", now=now)


@pytest.mark.parametrize(
    ("network", "subject"),
    [("facebook", "session-1"), ("instagram", "session-2")],
)
def test_state_cannot_be_used_for_another_network_or_session(db, network, subject):
    now = datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
    state = issue_oauth_state(db, network="instagram", session_subject="session-1", now=now)
    assert not consume_oauth_state(db, state=state, network=network, session_subject=subject, now=now)


def test_expired_state_is_rejected(db):
    now = datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
    state = issue_oauth_state(db, network="instagram", session_subject="session-1", now=now, ttl_seconds=60)
    assert not consume_oauth_state(
        db, state=state, network="instagram", session_subject="session-1",
        now=now + timedelta(seconds=61),
    )


def test_state_rejects_naive_datetime(db):
    with pytest.raises(ValueError):
        issue_oauth_state(
            db, network="instagram", session_subject="session-1",
            now=datetime(2026, 11, 8, 12),
        )


def test_ttl_is_bounded(db):
    with pytest.raises(ValueError):
        issue_oauth_state(db, network="instagram", session_subject="session-1", ttl_seconds=901)
