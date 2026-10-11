import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.course import Course, CourseMembership
from app.models.user import User
from app.schemas.course import CourseCreate, CourseOut

router = APIRouter(prefix="/courses", tags=["courses"])


def _serialize(course: Course, *, member_ids: set[uuid.UUID], viewer_id: uuid.UUID) -> CourseOut:
    return CourseOut(
        id=course.id,
        name=course.name,
        subject_id=course.subject_id,
        member_count=len(course.memberships),
        is_member=viewer_id in member_ids,
    )


@router.get("", response_model=list[CourseOut])
def list_courses(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    courses = (
        db.query(Course)
        .options(joinedload(Course.memberships))
        .filter(Course.school_class_id == user.school_class_id)
        .all()
    )
    return [
        _serialize(c, member_ids={m.user_id for m in c.memberships}, viewer_id=user.id) for c in courses
    ]


@router.post("", response_model=CourseOut)
def create_course(
    payload: CourseCreate,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    course = Course(name=payload.name, subject_id=payload.subject_id, school_class_id=user.school_class_id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _serialize(course, member_ids=set(), viewer_id=user.id)


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: uuid.UUID,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    db.delete(course)
    db.commit()


@router.post("/{course_id}/join", response_model=CourseOut)
def join_course(
    course_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    existing = db.query(CourseMembership).filter(
        CourseMembership.course_id == course_id, CourseMembership.user_id == user.id
    ).first()
    if existing is not None:
        db.refresh(course)
        return _serialize(course, member_ids={m.user_id for m in course.memberships}, viewer_id=user.id)

    # At most one course per subject - e.g. can't be in both "Mathe LK" and "Mathe GK", or both
    # "Religion katholisch" and "Religion evangelisch". Courses without a subject (electives/AGs)
    # aren't limited this way.
    if course.subject_id is not None:
        same_subject_membership = (
            db.query(CourseMembership)
            .join(Course, CourseMembership.course_id == Course.id)
            .filter(
                CourseMembership.user_id == user.id,
                Course.subject_id == course.subject_id,
                Course.id != course_id,
            )
            .first()
        )
        if same_subject_membership is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Du bist für dieses Fach bereits in einem anderen Kurs - erst dort austreten.",
            )

    db.add(CourseMembership(course_id=course_id, user_id=user.id))
    db.commit()
    db.refresh(course)
    return _serialize(course, member_ids={m.user_id for m in course.memberships}, viewer_id=user.id)


@router.delete("/{course_id}/leave", status_code=204)
def leave_course(
    course_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    membership = db.query(CourseMembership).filter(
        CourseMembership.course_id == course_id, CourseMembership.user_id == user.id
    ).first()
    if membership is None:
        return
    db.delete(membership)
    db.commit()
