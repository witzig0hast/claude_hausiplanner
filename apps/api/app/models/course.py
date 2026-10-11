import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    """A group of class members who share something specific - either a parallel timetable
    track (e.g. "Religion katholisch" running at the same slot as "Religion evangelisch" and
    "Ethik"), or, in a class running in pure "courses" mode (Oberstufe-style), the only
    organizing unit at all (e.g. "Mathe LK", no shared timetable). Both cases use the same
    entity: a named group with optional subject link and a membership list."""

    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="courses")

    # Optional: ties the course to a Subject for color/icon reuse and subject-level stats.
    # Null for freeform groups that aren't really "a subject" (e.g. an AG/elective) - those
    # don't count against the "max one course per subject" membership rule below.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    subject: Mapped["Subject"] = relationship()

    memberships: Mapped[list["CourseMembership"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class CourseMembership(Base):
    """Which users belong to which course. A user may belong to any number of subject-less
    courses (electives/AGs), but at most one course per subject_id - enforced in the router,
    not the DB, since the subject constraint only applies conditionally (subject_id not null)."""

    __tablename__ = "course_memberships"
    __table_args__ = (UniqueConstraint("course_id", "user_id", name="uq_course_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    course: Mapped["Course"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="course_memberships")
