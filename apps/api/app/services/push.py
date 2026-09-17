from exponent_server_sdk import DeviceNotRegisteredError, PushClient, PushMessage
from sqlalchemy.orm import Session

from app.models.push_token import PushToken


def send_gentle_reminder(db: Session, user_id, title: str, body: str) -> None:
    """Sends a calm, single push per device - no escalation, no alarm sound."""
    tokens = db.query(PushToken).filter(PushToken.user_id == user_id).all()
    if not tokens:
        return

    client = PushClient()
    for token in tokens:
        try:
            client.publish(
                PushMessage(
                    to=token.token,
                    title=title,
                    body=body,
                    sound="default",
                    priority="normal",
                )
            )
        except DeviceNotRegisteredError:
            db.delete(token)
    db.commit()
