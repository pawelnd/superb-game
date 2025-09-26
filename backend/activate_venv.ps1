Write-Host "Activating Python virtual environment..." -ForegroundColor Green

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"

Write-Host "Virtual environment activated!" -ForegroundColor Green
Write-Host "To deactivate, simply run: deactivate" -ForegroundColor Yellow
Write-Host ""

Write-Host "Installing/updating dependencies..." -ForegroundColor Blue
pip install -r requirements.txt

Write-Host ""
Write-Host "Ready to run the application with: python main.py" -ForegroundColor Cyan
