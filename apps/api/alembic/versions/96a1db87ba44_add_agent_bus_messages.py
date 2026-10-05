"""add agent_bus_messages table

Revision ID: 96a1db87ba44
Revises: 7c3e9a2f5d8b
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96a1db87ba44'
down_revision: Union[str, None] = '7c3e9a2f5d8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_bus_messages',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('remote_id', sa.String(length=64), nullable=False),
        sa.Column('direction', sa.String(length=10), nullable=False),
        sa.Column('peer_label', sa.String(length=64), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(length=64), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_agent_bus_messages_remote_id'), 'agent_bus_messages', ['remote_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_bus_messages_remote_id'), table_name='agent_bus_messages')
    op.drop_table('agent_bus_messages')
