# Superb Game Backend

This is the backend API for the Superb Game project, built with FastAPI.

## Python Virtual Environment Setup

The backend uses a Python virtual environment to manage dependencies. We've provided scripts to make setup and activation easy across different platforms.

### Quick Setup

#### Windows (Command Prompt)
```bash
# Run the setup script
setup_venv.bat

# Or manually activate the existing environment
activate_venv.bat
```

#### Windows (PowerShell)
```powershell
# You may need to enable script execution first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run the activation script
.\activate_venv.ps1
```

#### Linux/macOS
```bash
# Make scripts executable (if needed)
chmod +x setup_venv.sh activate_venv.sh

# Run the setup script
./setup_venv.sh

# Or manually activate the existing environment
./activate_venv.sh
```

### Manual Setup (Alternative)

If you prefer to set up manually:

1. **Create virtual environment:**
   ```bash
   # Windows
   python -m venv venv

   # Linux/macOS
   python3 -m venv venv
   ```

2. **Activate virtual environment:**
   ```bash
   # Windows (Command Prompt)
   venv\Scripts\activate

   # Windows (PowerShell)
   venv\Scripts\Activate.ps1

   # Linux/macOS
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### Available Scripts

| Script | Platform | Purpose |
|--------|----------|---------|
| [`setup_venv.bat`](backend/setup_venv.bat:1) | Windows | Complete setup from scratch |
| [`setup_venv.sh`](backend/setup_venv.sh:1) | Linux/macOS | Complete setup from scratch |
| [`activate_venv.bat`](backend/activate_venv.bat:1) | Windows | Activate existing environment |
| [`activate_venv.ps1`](backend/activate_venv.ps1:1) | Windows (PowerShell) | Activate existing environment |
| [`activate_venv.sh`](backend/activate_venv.sh:1) | Linux/macOS | Activate existing environment |

## Running the Application

Once your virtual environment is activated and dependencies are installed:

```bash
# Run the development server
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **Main API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

## API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /api/items` - Get all items
- `GET /api/items/{item_id}` - Get specific item
- `POST /api/items` - Create new item
- `DELETE /api/items/{item_id}` - Delete item

## Development

### Adding Dependencies

When you add new Python packages:

1. Activate your virtual environment
2. Install the package: `pip install package-name`
3. Update requirements: `pip freeze > requirements.txt`

### Deactivating the Environment

To exit the virtual environment:
```bash
deactivate
```

## Docker Alternative

If you prefer using Docker instead of a local virtual environment, you can use the provided [`Dockerfile`](backend/Dockerfile:1):

```bash
# Build the container
docker build -t superb-game-backend .

# Run the container
docker run -p 8000:8000 superb-game-backend
```

Or use the full stack with [`docker-compose.yml`](docker-compose.yml:1) from the project root:
```bash
docker-compose up
```

## Project Structure

```
backend/
├── main.py              # Main FastAPI application
├── requirements.txt     # Python dependencies
├── Dockerfile          # Docker configuration
├── setup_venv.bat      # Windows setup script
├── setup_venv.sh       # Unix setup script
├── activate_venv.bat   # Windows activation script
├── activate_venv.ps1   # PowerShell activation script
├── activate_venv.sh    # Unix activation script
├── venv/               # Virtual environment (auto-generated)
└── README.md           # This file
```

## Troubleshooting

### Common Issues

**Python not found:**
- Make sure Python is installed and added to your system PATH
- On Linux/macOS, try using `python3` instead of `python`

**Permission denied on scripts (Linux/macOS):**
```bash
chmod +x *.sh
```

**PowerShell execution policy error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Virtual environment not activating:**
- Make sure you're in the `backend` directory
- Try deleting the `venv` folder and running setup again

**Import errors:**
- Make sure your virtual environment is activated
- Reinstall requirements: `pip install -r requirements.txt`
