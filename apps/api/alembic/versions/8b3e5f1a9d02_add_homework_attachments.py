"""add homework_attachments table

Revision ID: 8b3e5f1a9d02
Revises: 4f1a9c6d2e07
Create Date: 2026-10-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b3e5f1a9d02'
down_revision: Union[str, None] = '4f1a9c6d2e07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'homework_attachments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('homework_id', sa.Uuid(), nullable=False),
        sa.Column('uploaded_by_id', sa.Uuid(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['homework_id'], ['homework.id']),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_homework_attachments_homework_id'), 'homework_attachments', ['homework_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_homework_attachments_homework_id'), table_name='homework_attachments')
    op.drop_table('homework_attachments')
