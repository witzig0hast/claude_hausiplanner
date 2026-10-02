from datetime import datetime, time, timedelta


def next_occurrence(after: datetime, weekday: int, lesson_time: time) -> datetime:
    """Next datetime strictly after `after` that falls on `weekday` at `lesson_time`."""
    days_ahead = (weekday - after.weekday()) % 7
    candidate = datetime.combine(after.date() + timedelta(days=days_ahead), lesson_time)
    if candidate <= after:
        candidate += timedelta(days=7)
    return candidate
