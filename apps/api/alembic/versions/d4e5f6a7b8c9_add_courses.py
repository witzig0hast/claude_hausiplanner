"""add courses, course_memberships, organization_mode, course_id on homework/calendar_events

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'school_classes',
        sa.Column('organization_mode', sa.String(length=16), nullable=False, server_default='timetable'),
    )

    op.create_table(
        'courses',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('school_class_id', sa.Uuid(), nullable=False),
        sa.Column('subject_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['school_class_id'], ['school_classes.id']),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'course_memberships',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('course_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'user_id', name='uq_course_user'),
    )

    op.add_column('homework', sa.Column('course_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_homework_course_id', 'homework', 'courses', ['course_id'], ['id'])

    op.add_column('calendar_events', sa.Column('course_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_calendar_events_course_id', 'calendar_events', 'courses', ['course_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_calendar_events_course_id', 'calendar_events', type_='foreignkey')
    op.drop_column('calendar_events', 'course_id')
    op.drop_constraint('fk_homework_course_id', 'homework', type_='foreignkey')
    op.drop_column('homework', 'course_id')
    op.drop_table('course_memberships')
    op.drop_table('courses')
    op.drop_column('school_classes', 'organization_mode')
