#!/bin/bash

# Deployment Script for Plantation & Tree Analytics Dashboard
# This script helps sync local changes to GitHub and apply them to the live environment.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   🚀 Deployment & Sync Tool 🚀   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Sync Local Changes to GitHub
echo -e "${YELLOW}Step 1: Syncing local changes to GitHub...${NC}"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git add .
    git commit -m "deploy: update project with latest changes" || echo "No changes to commit"
    git push origin main
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Local changes pushed to GitHub successfully.${NC}"
    else
        echo -e "${RED}❌ Failed to push changes to GitHub. Please check your connection/auth.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ This directory is not a git repository.${NC}"
    exit 1
fi

echo -e ""
echo -e "${BLUE}====================================================${NC}"
echo -e "${YELLOW}Step 2: Update the Live Environment${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "To apply these changes on your live server, run the following commands ON THE SERVER:"
echo -e ""
echo -e "${GREEN}cd /path/to/gis-gui${NC}"
echo -e "${GREEN}git pull origin main${NC}"
echo -e "${GREEN}docker compose up --build -d${NC}"
echo -e ""
echo -e "${YELLOW}Alternatively, if you are ALREADY on the server, would you like to update now? (y/n)${NC}"
read -r -p "Run update now? " response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Updating live environment...${NC}"
    git pull origin main
    docker compose up --build -d
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✨ Live environment updated successfully!${NC}"
    else
        echo -e "${RED}❌ Update failed on server.${NC}"
    fi
else
    echo -e "${BLUE}Sync complete. Remember to run the update commands on your live server.${NC}"
fi

echo -e "${BLUE}====================================================${NC}"
