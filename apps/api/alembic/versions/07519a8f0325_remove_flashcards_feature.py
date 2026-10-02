"""remove flashcards feature

Revision ID: 07519a8f0325
Revises: d46cb1198991
Create Date: 2026-10-02 18:56:46.847240

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07519a8f0325'
down_revision: Union[str, None] = 'd46cb1198991'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop in FK-dependency order (progress -> flashcards -> decks) so this also
    # works on Postgres, not just SQLite (which doesn't enforce FKs by default).
    op.drop_table('flashcard_progress')
    op.drop_table('flashcards')
    op.drop_table('flashcard_decks')


def downgrade() -> None:
    # Create in FK-dependency order (decks -> flashcards -> progress), the reverse
    # of upgrade()'s drop order.
    op.create_table('flashcard_decks',
    sa.Column('id', sa.CHAR(length=32), nullable=False),
    sa.Column('title', sa.VARCHAR(length=200), nullable=False),
    sa.Column('source_text', sa.TEXT(), nullable=True),
    sa.Column('created_at', sa.DATETIME(), nullable=False),
    sa.Column('school_class_id', sa.CHAR(length=32), nullable=False),
    sa.Column('created_by_id', sa.CHAR(length=32), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['school_class_id'], ['school_classes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('flashcards',
    sa.Column('id', sa.CHAR(length=32), nullable=False),
    sa.Column('question', sa.TEXT(), nullable=False),
    sa.Column('answer', sa.TEXT(), nullable=False),
    sa.Column('created_at', sa.DATETIME(), nullable=False),
    sa.Column('deck_id', sa.CHAR(length=32), nullable=False),
    sa.ForeignKeyConstraint(['deck_id'], ['flashcard_decks.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('flashcard_progress',
    sa.Column('id', sa.CHAR(length=32), nullable=False),
    sa.Column('flashcard_id', sa.CHAR(length=32), nullable=False),
    sa.Column('user_id', sa.CHAR(length=32), nullable=False),
    sa.Column('box', sa.INTEGER(), nullable=False),
    sa.Column('next_review_at', sa.DATETIME(), nullable=False),
    sa.ForeignKeyConstraint(['flashcard_id'], ['flashcards.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('flashcard_id', 'user_id', name='uq_progress_flashcard_user')
    )
