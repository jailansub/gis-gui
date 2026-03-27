#!/bin/bash

# Project Start Script for Plantation & Tree Analytics Dashboard

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   🌲 Plantation & Tree Analytics Dashboard 🌲   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed. Please install it to continue.${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}Error: docker compose is not installed. Please install it to continue.${NC}"
    exit 1
fi

echo -e "${GREEN}Prerequisites met.${NC}"

# Build and start services
echo -e "${YELLOW}Starting all services (this may take a few minutes on first run)...${NC}"
docker compose up --build -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to start services with docker compose.${NC}"
    exit 1
fi

echo -e "${GREEN}Services started successfully.${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to be healthy...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
BACKEND_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/api/health > /dev/null; then
        BACKEND_HEALTHY=true
        break
    fi
    echo -n "."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done

echo ""

if [ "$BACKEND_HEALTHY" = true ]; then
    echo -e "${GREEN}Backend is healthy and ready!${NC}"
else
    echo -e "${YELLOW}Backend is still starting up, but you can try accessing it shortly.${NC}"
fi

# Summary
echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}ALL SERVICES ARE RUNNING!${NC}"
echo -e ""
echo -e "Frontend URL:  ${BLUE}http://localhost:5173${NC}"
echo -e "Backend API:   ${BLUE}http://localhost:8000/api/docs${NC}"
echo -e ""
echo -e "To view logs:  ${YELLOW}docker compose logs -f${NC}"
echo -e "To stop:       ${YELLOW}docker compose down${NC}"
echo -e "${BLUE}====================================================${NC}"

# Attempt to open the browser (optional, works on most Linux/MacOS)
if command -v xdg-open &> /dev/null; then
    echo -e "${YELLOW}Opening frontend in your browser...${NC}"
    xdg-open http://localhost:5173 &> /dev/null
elif command -v open &> /dev/null; then
    echo -e "${YELLOW}Opening frontend in your browser...${NC}"
    open http://localhost:5173 &> /dev/null
fi
