"""add seen_product_intro to users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users', sa.Column('seen_product_intro', sa.Boolean(), nullable=False, server_default=sa.true())
    )
    # Every account that already exists gets the "was ist neu" popup exactly once - only new
    # signups (who never knew anything else) skip it, via the column's True default above.
    op.execute('UPDATE users SET seen_product_intro = false')


def downgrade() -> None:
    op.drop_column('users', 'seen_product_intro')
