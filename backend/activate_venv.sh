#!/bin/bash

echo "Activating Python virtual environment..."

# Activate virtual environment
source venv/bin/activate

echo "Virtual environment activated!"
echo "To deactivate, simply run: deactivate"
echo ""

echo "Installing/updating dependencies..."
pip install -r requirements.txt

echo ""
echo "Ready to run the application with: python main.py"

# Keep shell open
exec "$SHELL"
