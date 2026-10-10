"""add sso_subject to users

Revision ID: 3d6f82ac9b17
Revises: 8b3e5f1a9d02
Create Date: 2026-10-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d6f82ac9b17'
down_revision: Union[str, None] = '8b3e5f1a9d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('sso_subject', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_sso_subject'), 'users', ['sso_subject'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_sso_subject'), table_name='users')
    op.drop_column('users', 'sso_subject')
