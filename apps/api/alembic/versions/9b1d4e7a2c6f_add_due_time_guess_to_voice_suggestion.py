"""add due_time_guess to pending_homework_suggestions

Revision ID: 9b1d4e7a2c6f
Revises: 3a7c9e2b4f1d
Create Date: 2026-10-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b1d4e7a2c6f'
down_revision: Union[str, None] = '3a7c9e2b4f1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'pending_homework_suggestions', sa.Column('due_time_guess', sa.String(length=5), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('pending_homework_suggestions', 'due_time_guess')
