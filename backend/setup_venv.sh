#!/bin/bash

echo "Setting up Python virtual environment for Superb Game Backend..."
echo

echo "1. Creating virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment"
    echo "Make sure Python 3 is installed and available"
    exit 1
fi

echo "2. Activating virtual environment..."
source venv/bin/activate

echo "3. Upgrading pip..."
python -m pip install --upgrade pip

echo "4. Installing requirements..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install requirements"
    exit 1
fi

echo
echo "Setup complete! Virtual environment is ready."
echo "To activate the environment in the future, run: ./activate_venv.sh"
echo "To run the application: python main.py"
echo
