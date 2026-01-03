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
    gunzip -c $backup_file | docker compose -f $COMPOSE_FILE exec -T postgres psql -U askbox askbox
    echo -e "${GREEN}Restore complete!${NC}"
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
    help|*)
        help
        ;;
esac
