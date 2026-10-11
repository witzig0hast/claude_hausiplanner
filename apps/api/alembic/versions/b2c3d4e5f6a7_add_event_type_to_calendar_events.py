"""add event_type to calendar_events

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_events',
        sa.Column('event_type', sa.String(length=16), nullable=False, server_default='lesson'),
    )
    # Existing non-recurring one-off events were all generic "Termine" with no distinction -
    # leave them as "lesson" is wrong (they were never weekly lessons); reclassify to "other" so
    # they land in "sonstige Termine" instead of silently looking like timetable slots.
    op.execute("UPDATE calendar_events SET event_type = 'other' WHERE is_recurring_weekly = false")


def downgrade() -> None:
    op.drop_column('calendar_events', 'event_type')
