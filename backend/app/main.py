from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import brands, sizing_charts, measurements, public_catalog, admin
from .auth import router as auth_router

def validate_production_security():
    """Fail closed at startup if production or staging environment lacks a secure JWT secret."""
    if settings.requires_strong_jwt_secret:
        settings.get_jwt_signing_secret()

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_production_security()
    yield

app = FastAPI(
    title="PressOn Fit Brand API",
    description="Business logic, onboarding, profile and sizing chart management for PressOn Fit brands",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS (environment-aware: development includes localhost, staging/production uses explicit origins only)
origins = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(brands.router)
app.include_router(sizing_charts.router)
app.include_router(measurements.router)
app.include_router(public_catalog.router)
app.include_router(admin.router)



@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "presson-fit-brand-api",
        "supabase_url": settings.SUPABASE_URL,
        "database_configured": settings.is_database_configured
    }
