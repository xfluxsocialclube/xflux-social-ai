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
