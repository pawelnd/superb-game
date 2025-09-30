from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Welcome to Superb Game API"}


@router.get("/health")
async def health_check():
    return {"status": "healthy"}