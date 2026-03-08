#!/usr/bin/env bash
# =============================================================================
#  Engram Platform — Health Monitor
#  Continuous health checking with alerting and auto-recovery
# =============================================================================
set -euo pipefail

# Configuration
HEALTH_INTERVAL="${HEALTH_INTERVAL:-30}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
COMPOSE_FILE="/opt/engram/docker-compose.yml"
COMPOSE_PROJECT="engram-platform"
LOG_FILE="/var/log/engram/health-monitor.log"
STATE_FILE="/var/run/engram-health/state"
ALERT_STATE_FILE="/var/run/engram-health/alerts"

# Alert thresholds
MAX_RESTART_ATTEMPTS=3
RESTART_WINDOW_SECONDS=300  # 5 minutes

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

# =============================================================================
# Logging
# =============================================================================
log() {
    local level="$1"; shift
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}
log_info()  { log "INFO" "$*"; }
log_warn()  { log "WARN" "$*"; }
log_error() { log "ERROR" "$*"; }
log_debug() { log "DEBUG" "$*"; }

# =============================================================================
# Initialize
# =============================================================================
init() {
    mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$STATE_FILE")" "$(dirname "$ALERT_STATE_FILE")"
    : > "$LOG_FILE" 2>/dev/null || true
    log_info "Health monitor started (interval: ${HEALTH_INTERVAL}s)"
}

# =============================================================================
# Track restart attempts for crash detection
# =============================================================================
declare -A RESTART_COUNTS
declare -A RESTART_TIMES

record_restart() {
    local service="$1"
    local now=$(date +%s)

    # Reset if outside window
    if [[ -n "${RESTART_TIMES[$service]:-}" ]] && \
       (( now - RESTART_TIMES[$service] > RESTART_WINDOW_SECONDS )); then
        RESTART_COUNTS[$service]=0
        RESTART_TIMES[$service]=$now
    fi

    RESTART_COUNTS[$service]=$(( ${RESTART_COUNTS[$service]:-0} + 1 ))
    RESTART_TIMES[$service]=$now

    log_warn "Restart detected: $service (${RESTART_COUNTS[$service]} in ${RESTART_WINDOW_SECONDS}s)"

    # Check if too many restarts
    if (( RESTART_COUNTS[$service] >= MAX_RESTART_ATTEMPTS )); then
        alert_crash_loop "$service"
        return 1
    fi
    return 0
}

# =============================================================================
# Alerting
# =============================================================================
send_alert() {
    local subject="$1"
    local message="$2"

    log_error "ALERT: $subject - $message"

    # Track last alert time to prevent spam
    local alert_key="$(echo "$subject" | tr ' ' '_')"
    local last_alert_file="$ALERT_STATE_FILE-$alert_key"
    local now=$(date +%s)

    if [[ -f "$last_alert_file" ]]; then
        local last_alert
        last_alert=$(cat "$last_alert_file")
        # Only alert once per hour per issue
        if (( now - last_alert < 3600 )); then
            log_debug "Skipping duplicate alert: $subject"
            return
        fi
    fi

    echo "$now" > "$last_alert_file"

    # Email alert if configured
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &>/dev/null; then
        echo "$message" | mail -s "[ENGRAM] $subject" "$ALERT_EMAIL" 2>/dev/null || true
    fi

    # Also log to syslog
    logger -t engram-health -p err "$subject: $message"
}

alert_crash_loop() {
    local service="$1"
    send_alert "CRASH LOOP DETECTED" "Service $service has restarted $MAX_RESTART_ATTEMPTS times in $RESTART_WINDOW_SECONDS seconds. Manual intervention required."
}

alert_service_down() {
    local service="$1"
    send_alert "SERVICE DOWN" "Service $service is not running"
}

alert_service_unhealthy() {
    local service="$1"
    send_alert "SERVICE UNHEALTHY" "Service $service health check failed"
}

# =============================================================================
# Health check functions
# =============================================================================
check_container_health() {
    local container="$1"

    # Check if container exists and is running
    if ! docker inspect "$container" &>/dev/null; then
        return 2  # Container not found
    fi

    local state
    state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)

    if [[ "$state" != "running" ]]; then
        return 2  # Not running
    fi

    # Check health if defined
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")

    case "$health" in
        healthy) return 0 ;;
        unhealthy) return 1 ;;
        starting|"") return 0 ;;  # Starting is OK, no health check is OK
        *) return 0 ;;
    esac
}

check_endpoint() {
    local url="$1"
    curl -fsS --max-time 5 "$url" &>/dev/null
}

# =============================================================================
# Recovery actions
# =============================================================================
restart_service() {
    local service="$1"
    log_info "Attempting to restart service: $service"

    # Record the restart attempt
    if ! record_restart "$service"; then
        log_error "Service $service in crash loop, not restarting"
        return 1
    fi

    # Try to restart via docker compose
    if docker compose -f "$COMPOSE_FILE" restart "$service" &>/dev/null; then
        log_info "Service $service restarted successfully"
        return 0
    else
        log_error "Failed to restart service $service"
        return 1
    fi
}

restart_stack() {
    log_warn "Multiple services failed, restarting entire stack..."

    docker compose -f "$COMPOSE_FILE" restart
    return $?
}

# =============================================================================
# Main monitoring loop
# =============================================================================
monitor() {
    local consecutive_failures=0
    local max_consecutive_failures=3

    while true; do
        local failed_services=()
        local unhealthy_services=()

        # Get all services from compose file
        local services
        services=$(docker compose -f "$COMPOSE_FILE" ps --services 2>/dev/null) || {
            log_error "Failed to get services from compose file"
            sleep "$HEALTH_INTERVAL"
            continue
        }

        # Check each service
        for service in $services; do
            local container="${COMPOSE_PROJECT}-${service}"

            case "$(check_container_health "$container" || echo "2")" in
                0)  # Healthy
                    log_debug "$service: healthy"
                    ;;
                1)  # Unhealthy
                    log_warn "$service: unhealthy"
                    unhealthy_services+=("$service")
                    ;;
                2)  # Not running
                    log_error "$service: not running"
                    failed_services+=("$service")
                    ;;
            esac
        done

        # Check critical endpoints
        local endpoints_down=()
        if ! check_endpoint "http://localhost:8080/health"; then
            endpoints_down+=("nginx/health")
        fi
        if ! check_endpoint "http://localhost:8000/health"; then
            endpoints_down+=("memory-api")
        fi
        if ! check_endpoint "http://localhost:11235/"; then
            endpoints_down+=("crawler-api")
        fi

        # Process failures
        if (( ${#failed_services[@]} > 0 )) || \
           (( ${#unhealthy_services[@]} > 0 )) || \
           (( ${#endpoints_down[@]} > 0 )); then

            consecutive_failures=$((consecutive_failures + 1))

            # Try to recover individual services
            for svc in "${failed_services[@]}"; do
                alert_service_down "$svc"
                restart_service "$svc" || true
            done

            for svc in "${unhealthy_services[@]}"; do
                alert_service_unhealthy "$svc"
                restart_service "$svc" || true
            done

            # If too many consecutive failures, restart stack
            if (( consecutive_failures >= max_consecutive_failures )); then
                log_error "Multiple consecutive failures, restarting stack..."
                restart_stack
                consecutive_failures=0
            fi
        else
            # All healthy, reset counter
            consecutive_failures=0
            log_debug "All services healthy"
        fi

        sleep "$HEALTH_INTERVAL"
    done
}

# =============================================================================
# Signal handling
# =============================================================================
trap 'log_info "Health monitor stopped"; exit 0' TERM INT

# =============================================================================
# Main
# =============================================================================
init
monitor
