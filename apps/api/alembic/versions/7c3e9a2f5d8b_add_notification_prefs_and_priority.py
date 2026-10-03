"""add notification prefs to users and priority to homework

Revision ID: 7c3e9a2f5d8b
Revises: 2d5f8a1b6e4c
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c3e9a2f5d8b'
down_revision: Union[str, None] = '2d5f8a1b6e4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('digest_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('deadline_push_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('priorities_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('homework', sa.Column('priority', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('homework', 'priority')
    op.drop_column('users', 'priorities_enabled')
    op.drop_column('users', 'deadline_push_enabled')
    op.drop_column('users', 'digest_enabled')
