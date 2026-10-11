"""add calendar_feed_token to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('calendar_feed_token', sa.String(length=64), nullable=True))
    op.create_index('ix_users_calendar_feed_token', 'users', ['calendar_feed_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_calendar_feed_token', table_name='users')
    op.drop_column('users', 'calendar_feed_token')
