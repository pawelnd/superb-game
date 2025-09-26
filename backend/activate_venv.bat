@echo off
echo Activating Python virtual environment...
call venv\Scripts\activate.bat
echo Virtual environment activated!
echo To deactivate, simply run: deactivate
echo.
echo Installing/updating dependencies...
pip install -r requirements.txt
echo.
echo Ready to run the application with: python main.py
cmd /k
