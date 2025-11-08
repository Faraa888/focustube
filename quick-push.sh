#!/bin/bash
# Quick git commit and push script for FocusTube
# Usage: ./quick-push.sh "Your commit message"

# Get commit message from argument or use default
COMMIT_MSG="${1:-Quick commit}"

# Add all changes
git add .

# Commit with message
git commit -m "$COMMIT_MSG"

# Push to main
git push origin main

echo "✅ Pushed to GitHub!"

