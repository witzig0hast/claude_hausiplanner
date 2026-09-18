from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent, auth, calendar, classes, homework, planning, sys_admin
from app.services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (see alembic/), run via
    # `alembic upgrade head` before starting the app - not here.
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Hausiplanner API", lifespan=lifespan)

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


@app.get("/health")
def health():
    return {"status": "ok"}
