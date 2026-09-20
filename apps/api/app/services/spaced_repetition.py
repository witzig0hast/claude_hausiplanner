"""Simple 5-box Leitner system: a wrong answer always drops back to box 1,
a right answer advances a box and pushes the next review further out."""

from datetime import datetime, timedelta

BOX_INTERVALS_DAYS = {1: 0, 2: 1, 3: 3, 4: 7, 5: 14}
MAX_BOX = 5


def apply_review(box: int, result: str) -> tuple[int, datetime]:
    if result == "know":
        new_box = min(box + 1, MAX_BOX)
    else:
        new_box = 1
    interval = timedelta(days=BOX_INTERVALS_DAYS[new_box])
    return new_box, datetime.utcnow() + interval
