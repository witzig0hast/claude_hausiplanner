"""make agent bus connections per-user instead of server-global

Revision ID: 4f1a9c6d2e07
Revises: 96a1db87ba44
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f1a9c6d2e07'
down_revision: Union[str, None] = '96a1db87ba44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('ownai_agent_bus_key_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('ownai_agent_bus_base_url', sa.String(length=255), nullable=True))
    op.add_column(
        'users', sa.Column('ownai_agent_bus_enabled', sa.Boolean(), nullable=False, server_default=sa.true())
    )

    op.drop_index(op.f('ix_agent_bus_messages_remote_id'), table_name='agent_bus_messages')
    op.add_column('agent_bus_messages', sa.Column('user_id', sa.Uuid(), nullable=True))
    # No rows can exist yet (this feature was never deployed before it became per-user), so a
    # hard NOT NULL + FK is safe without a data backfill step.
    op.execute('DELETE FROM agent_bus_messages')
    op.alter_column('agent_bus_messages', 'user_id', nullable=False)
    op.create_foreign_key(
        'fk_agent_bus_messages_user_id', 'agent_bus_messages', 'users', ['user_id'], ['id']
    )
    op.create_index(
        op.f('ix_agent_bus_messages_user_id'), 'agent_bus_messages', ['user_id'], unique=False
    )
    op.create_unique_constraint(
        'uq_agent_bus_message_user_remote', 'agent_bus_messages', ['user_id', 'remote_id']
    )


def downgrade() -> None:
    op.drop_constraint('uq_agent_bus_message_user_remote', 'agent_bus_messages', type_='unique')
    op.drop_index(op.f('ix_agent_bus_messages_user_id'), table_name='agent_bus_messages')
    op.drop_constraint('fk_agent_bus_messages_user_id', 'agent_bus_messages', type_='foreignkey')
    op.drop_column('agent_bus_messages', 'user_id')
    op.create_index(op.f('ix_agent_bus_messages_remote_id'), 'agent_bus_messages', ['remote_id'], unique=True)

    op.drop_column('users', 'ownai_agent_bus_enabled')
    op.drop_column('users', 'ownai_agent_bus_base_url')
    op.drop_column('users', 'ownai_agent_bus_key_encrypted')
