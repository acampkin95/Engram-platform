#!/bin/bash
set -e

echo "==================================="
echo "Starting Crawl4AI OSINT Container"
echo "==================================="
echo ""

# Source environment variables if .env exists
if [ -f /app/.env ]; then
    echo "Loading environment variables from .env"
    export $(cat /app/.env | grep -v '^#' | xargs)
fi

# Display configuration
echo "Configuration:"
echo "  App: ${APP_NAME:-crawl4ai-osint}"
echo "  Version: ${APP_VERSION:-0.1.0}"
echo "  Debug: ${DEBUG:-false}"
echo "  Log Level: ${LOG_LEVEL:-INFO}"
echo ""

# Check if supervisord is already running
if pgrep -x supervisord > /dev/null; then
    echo "Supervisord is already running. Reloading configuration..."
    supervisorctl -c /etc/supervisor/conf.d/supervisord.conf reload
else
    echo "Starting supervisord with configuration..."
    # Start supervisord in foreground (Docker expects main process)
    exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf -n
fi
