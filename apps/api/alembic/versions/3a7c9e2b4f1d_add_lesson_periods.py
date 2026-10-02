"""add lesson_periods table

Revision ID: 3a7c9e2b4f1d
Revises: 07519a8f0325
Create Date: 2026-10-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a7c9e2b4f1d'
down_revision: Union[str, None] = '07519a8f0325'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lesson_periods',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('school_class_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['school_class_id'], ['school_classes.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('lesson_periods')
