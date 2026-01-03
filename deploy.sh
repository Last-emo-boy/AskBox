#!/bin/bash

# AskBox Deployment Script
# Usage: ./deploy.sh [command]
# Commands: start, stop, restart, logs, status, update, backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Check if .env.production exists
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: $ENV_FILE not found!${NC}"
        echo "Please copy .env.production.example to .env.production and configure it."
        exit 1
    fi
}

# Start services
start() {
    check_env
    echo -e "${GREEN}Starting AskBox services...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build
    echo -e "${GREEN}Services started successfully!${NC}"
    status
}

# Stop services
stop() {
    echo -e "${YELLOW}Stopping AskBox services...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down
    echo -e "${GREEN}Services stopped.${NC}"
}

# Restart services
restart() {
    echo -e "${YELLOW}Restarting AskBox services...${NC}"
    stop
    start
}

# View logs
logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f
    else
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f $service
    fi
}

# Show status
status() {
    echo -e "${GREEN}AskBox Service Status:${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps
    echo ""
    echo -e "${GREEN}Health Status:${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps --format "table {{.Name}}\t{{.Status}}"
}

# Update and redeploy
update() {
    echo -e "${YELLOW}Updating AskBox...${NC}"
    git pull
    echo -e "${GREEN}Rebuilding and restarting services...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build
    echo -e "${GREEN}Update complete!${NC}"
    status
}

# Backup database
backup() {
    local backup_dir="./backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/askbox_backup_$timestamp.sql"
    
    mkdir -p $backup_dir
    
    echo -e "${YELLOW}Backing up database...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec -T postgres pg_dump -U askbox askbox > $backup_file
    
    if [ $? -eq 0 ]; then
        gzip $backup_file
        echo -e "${GREEN}Backup saved to ${backup_file}.gz${NC}"
    else
        echo -e "${RED}Backup failed!${NC}"
        exit 1
    fi
}

# Restore database
restore() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}Please specify a backup file to restore.${NC}"
        echo "Usage: ./deploy.sh restore <backup_file.sql.gz>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restoring database from $backup_file...${NC}"
    gunzip -c $backup_file | docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec -T postgres psql -U askbox askbox
    echo -e "${GREEN}Restore complete!${NC}"
}

# Delete everything (containers, volumes, images) for a fresh start
delete() {
    echo -e "${RED}WARNING: This will delete ALL AskBox data including:${NC}"
    echo "  - All containers"
    echo "  - All volumes (database data, redis data)"
    echo "  - All built images"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
    
    echo -e "${RED}Stopping and removing containers...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down -v --rmi local 2>/dev/null || true
    
    echo -e "${RED}Removing AskBox images...${NC}"
    docker images | grep -E "askbox" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    
    echo -e "${RED}Removing AskBox volumes...${NC}"
    # Only remove volumes that start with the project name (askbox)
    docker volume ls -q | grep -E "^askbox" | xargs -r docker volume rm 2>/dev/null || true
    
    echo -e "${GREEN}All AskBox data has been deleted.${NC}"
    echo -e "${YELLOW}Run './deploy.sh start' to deploy fresh.${NC}"
}

# Reset database only (keep containers but clear all data)
reset_db() {
    echo -e "${RED}WARNING: This will delete ALL database data!${NC}"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Resetting database...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec -T postgres psql -U askbox -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" askbox
    
    echo -e "${YELLOW}Running migrations...${NC}"
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec -T api npx prisma db push --skip-generate
    
    echo -e "${GREEN}Database reset complete!${NC}"
}

# Show help
help() {
    echo "AskBox Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs [svc]  View logs (optionally for specific service: api, web, postgres, redis)"
    echo "  status      Show service status"
    echo "  update      Pull latest code and redeploy"
    echo "  backup      Backup database"
    echo "  restore     Restore database from backup"
    echo "  delete      Delete ALL containers, volumes, and images (fresh start)"
    echo "  reset-db    Reset database only (clear all data, keep containers)"
    echo "  help        Show this help message"
}

# Main
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs $2
        ;;
    status)
        status
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    restore)
        restore $2
        ;;
    delete)
        delete
        ;;
    reset-db)
        reset_db
        ;;
    help|*)
        help
        ;;
esac
