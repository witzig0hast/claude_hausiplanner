"""Finds gaps between calendar events and slots open homework into them.

Deliberately simple (greedy, earliest-deadline-first) rather than a full optimizer -
good enough to turn "wann habe ich noch Zeit?" into a concrete suggestion.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models.calendar_event import CalendarEvent
from app.models.homework import Homework
from app.models.user import User

# "Study window" per day - after school, before it's too late in the evening.
DAY_START = time(15, 0)
DAY_END = time(21, 0)
DEFAULT_ESTIMATE_MINUTES = 30


@dataclass
class Interval:
    start: datetime
    end: datetime


def _expand_calendar_events(events: list[CalendarEvent], range_start: date, range_end: date) -> list[Interval]:
    busy: list[Interval] = []
    day_count = (range_end - range_start).days + 1

    for event in events:
        if event.is_recurring_weekly and event.weekday is not None:
            start_t = event.starts_at.time()
            end_t = event.ends_at.time()
            for offset in range(day_count):
                day = range_start + timedelta(days=offset)
                if day.weekday() == event.weekday:
                    busy.append(Interval(datetime.combine(day, start_t), datetime.combine(day, end_t)))
        else:
            if range_start <= event.starts_at.date() <= range_end:
                busy.append(Interval(event.starts_at, event.ends_at))

    return busy


def _merge(intervals: list[Interval]) -> list[Interval]:
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda i: i.start)
    merged = [ordered[0]]
    for iv in ordered[1:]:
        last = merged[-1]
        if iv.start <= last.end:
            last.end = max(last.end, iv.end)
        else:
            merged.append(iv)
    return merged


def _free_slots_for_range(busy: list[Interval], range_start: date, range_end: date) -> list[Interval]:
    free: list[Interval] = []
    day_count = (range_end - range_start).days + 1
    for offset in range(day_count):
        day = range_start + timedelta(days=offset)
        window = Interval(datetime.combine(day, DAY_START), datetime.combine(day, DAY_END))
        day_busy = sorted(
            (iv for iv in busy if iv.start.date() == day or iv.end.date() == day), key=lambda i: i.start
        )
        cursor = window.start
        for iv in day_busy:
            if iv.end <= window.start or iv.start >= window.end:
                continue
            clipped_start = max(iv.start, window.start)
            clipped_end = min(iv.end, window.end)
            if clipped_start > cursor:
                free.append(Interval(cursor, clipped_start))
            cursor = max(cursor, clipped_end)
        if cursor < window.end:
            free.append(Interval(cursor, window.end))
    return [f for f in free if (f.end - f.start) >= timedelta(minutes=10)]


def build_plan(db: Session, user: User, days_ahead: int = 7):
    now = datetime.utcnow()
    range_start = now.date()
    range_end = range_start + timedelta(days=days_ahead)

    events = db.query(CalendarEvent).filter(CalendarEvent.school_class_id == user.school_class_id).all()
    busy = _merge(_expand_calendar_events(events, range_start, range_end))
    free_slots = _free_slots_for_range(busy, range_start, range_end)

    homework = (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(
            Homework.school_class_id == user.school_class_id,
            Homework.due_at >= now,
            Homework.due_at <= datetime.combine(range_end, time(23, 59)),
        )
        .order_by(Homework.due_at.asc())
        .all()
    )
    open_items = [hw for hw in homework if not any(c.user_id == user.id for c in hw.completions)]

    remaining = [Interval(s.start, s.end) for s in free_slots]
    suggestions = []
    unscheduled: list[str] = []

    for hw in open_items:
        needed = timedelta(minutes=hw.estimated_minutes or DEFAULT_ESTIMATE_MINUTES)
        placed = False
        for slot in remaining:
            available = slot.end - slot.start
            if available >= needed and slot.end <= hw.due_at:
                suggestions.append(
                    {
                        "homework_id": hw.id,
                        "title": hw.title,
                        "subject_name": hw.subject.name,
                        "start": slot.start,
                        "end": slot.start + needed,
                        "minutes": hw.estimated_minutes or DEFAULT_ESTIMATE_MINUTES,
                    }
                )
                slot.start += needed
                placed = True
                break
        if not placed:
            unscheduled.append(hw.title)

    return {
        "free_slots": [{"start": s.start, "end": s.end} for s in free_slots],
        "suggestions": suggestions,
        "unscheduled": unscheduled,
    }
