import logging
from logging.config import fileConfig
from sqlalchemy import pool, create_engine
from alembic import context

from app.config import settings, mask_database_url, get_alembic_target_url
from app.models import Base

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# Target metadata for autogenerate support
target_metadata = Base.metadata

def get_target_url() -> str:
    """
    Retrieve database URL dynamically from environment/settings or alembic CLI override.
    Ensures safe error handling without leaking credentials.
    """
    return get_alembic_target_url(config, settings)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_target_url()
    logger.info("Running offline migrations against: %s", mask_database_url(url))
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = get_target_url()
    logger.info("Running online migrations against: %s", mask_database_url(url))

    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
