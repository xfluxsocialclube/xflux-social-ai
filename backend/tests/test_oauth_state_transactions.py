import sqlite3

from app.oauth_state import consume_oauth_state, issue_oauth_state


def test_state_is_committed_by_callers_transaction(tmp_path):
    database = tmp_path / "oauth.sqlite3"
    with sqlite3.connect(database) as db:
        state = issue_oauth_state(
            db,
            network="instagram",
            session_subject="authenticated-session-123",
        )

    # A new connection proves that the caller's transaction persisted the state.
    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        assert consume_oauth_state(
            db,
            state=state,
            network="instagram",
            session_subject="authenticated-session-123",
        )


def test_state_insert_can_be_rolled_back_by_callers_transaction(tmp_path):
    database = tmp_path / "oauth-rollback.sqlite3"
    db = sqlite3.connect(database)
    try:
        state = issue_oauth_state(
            db,
            network="instagram",
            session_subject="authenticated-session-123",
        )
        db.rollback()
    finally:
        db.close()

    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        assert not consume_oauth_state(
            db,
            state=state,
            network="instagram",
            session_subject="authenticated-session-123",
        )


from datetime import datetime, timedelta, timezone

import pytest


def test_state_is_one_time_and_bound_to_network_and_session(tmp_path):
    database = tmp_path / "oauth-one-time.sqlite3"
    now = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)
    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        state = issue_oauth_state(
            db,
            network="instagram",
            session_subject="session-user-a",
            now=now,
        )

    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        assert not consume_oauth_state(
            db, state=state, network="facebook",
            session_subject="session-user-a", now=now + timedelta(seconds=1),
        )
        assert not consume_oauth_state(
            db, state=state, network="instagram",
            session_subject="session-user-b", now=now + timedelta(seconds=1),
        )
        assert consume_oauth_state(
            db, state=state, network="instagram",
            session_subject="session-user-a", now=now + timedelta(seconds=1),
        )
        assert not consume_oauth_state(
            db, state=state, network="instagram",
            session_subject="session-user-a", now=now + timedelta(seconds=2),
        )


def test_expired_state_is_rejected(tmp_path):
    database = tmp_path / "oauth-expired.sqlite3"
    now = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)
    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        state = issue_oauth_state(
            db,
            network="youtube",
            session_subject="session-user",
            now=now,
            ttl_seconds=30,
        )

    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        assert not consume_oauth_state(
            db,
            state=state,
            network="youtube",
            session_subject="session-user",
            now=now + timedelta(seconds=30),
        )


def test_only_state_hash_is_persisted(tmp_path):
    database = tmp_path / "oauth-hash.sqlite3"
    with sqlite3.connect(database) as db:
        db.row_factory = sqlite3.Row
        state = issue_oauth_state(
            db,
            network="pinterest",
            session_subject="session-user",
        )
        row = db.execute("SELECT state_hash, session_hash FROM oauth_states").fetchone()
        assert row["state_hash"] != state
        assert len(row["state_hash"]) == 64
        assert len(row["session_hash"]) == 64


@pytest.mark.parametrize("ttl", [0, -1, 901])
def test_state_ttl_is_bounded(ttl):
    with sqlite3.connect(":memory:") as db:
        with pytest.raises(ValueError):
            issue_oauth_state(
                db,
                network="instagram",
                session_subject="session-user",
                ttl_seconds=ttl,
            )
