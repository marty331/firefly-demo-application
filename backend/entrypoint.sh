#!/bin/bash
set -e

# Install dependencies if .venv doesn't have them
if [ ! -f "/app/.venv/bin/uvicorn" ]; then
    echo "Installing dependencies..."
    uv sync --frozen
fi

# Run the command passed to the container
exec "$@"
