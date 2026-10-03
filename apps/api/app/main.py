import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import agent, auth, calendar, classes, homework, planning, sys_admin, voice
from app.services.scheduler import start_scheduler

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (see alembic/), run via
    # `alembic upgrade head` before starting the app - not here.
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Hausaufgabenplaner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your web domain once deployed
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(homework.router)
app.include_router(calendar.router)
app.include_router(agent.router)
app.include_router(planning.router)
app.include_router(sys_admin.router)
app.include_router(voice.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """An unhandled exception (e.g. a DB constraint violation) raised from inside a route
    bypasses CORSMiddleware's response if it's left to Starlette's default handling, so the
    browser sees a response with no Access-Control-Allow-Origin header and reports a generic,
    undebuggable network error ("Failed to fetch"/"Load failed") instead of the real one.
    Catching it here keeps the response inside the normal middleware stack, so it still comes
    back as a proper (CORS-compliant) 500 the frontend can actually show to the user."""
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health():
    return {"status": "ok"}
