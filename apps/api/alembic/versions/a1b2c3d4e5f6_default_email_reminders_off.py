"""default email_reminders_enabled off for everyone

Revision ID: a1b2c3d4e5f6
Revises: 3d6f82ac9b17
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3d6f82ac9b17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Was an always-on "email reminder" feature, now an opt-in "Vorschlags-E-Mail" - flips both
    # the default for new rows and every existing user's current setting, since nobody explicitly
    # chose this when it was silently on-by-default.
    op.alter_column('users', 'email_reminders_enabled', server_default=sa.false())
    op.execute('UPDATE users SET email_reminders_enabled = false')


def downgrade() -> None:
    op.alter_column('users', 'email_reminders_enabled', server_default=sa.true())
