@echo off
echo Setting up Python virtual environment for Superb Game Backend...
echo.

echo 1. Creating virtual environment...
python -m venv venv
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create virtual environment
    echo Make sure Python is installed and available in PATH
    pause
    exit /b 1
)

echo 2. Activating virtual environment...
call venv\Scripts\activate.bat

echo 3. Upgrading pip...
python -m pip install --upgrade pip

echo 4. Installing requirements...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install requirements
    pause
    exit /b 1
)

echo.
echo Setup complete! Virtual environment is ready.
echo To activate the environment in the future, run: activate_venv.bat
echo To run the application: python main.py
echo.
pause
