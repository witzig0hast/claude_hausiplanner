"""add due_is_estimated to pending_homework_suggestions

Revision ID: 2d5f8a1b6e4c
Revises: 6f2a8d3e9b1c
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d5f8a1b6e4c'
down_revision: Union[str, None] = '6f2a8d3e9b1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'pending_homework_suggestions',
        sa.Column('due_is_estimated', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('pending_homework_suggestions', 'due_is_estimated')
