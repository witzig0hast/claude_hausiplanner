"""add email_reminders_enabled to users

Revision ID: 6f2a8d3e9b1c
Revises: 9b1d4e7a2c6f
Create Date: 2026-10-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f2a8d3e9b1c'
down_revision: Union[str, None] = '9b1d4e7a2c6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users', sa.Column('email_reminders_enabled', sa.Boolean(), nullable=False, server_default=sa.true())
    )


def downgrade() -> None:
    op.drop_column('users', 'email_reminders_enabled')
