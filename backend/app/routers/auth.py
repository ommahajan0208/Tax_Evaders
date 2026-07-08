from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, Token, TokenRefresh, UserResponse
from app.auth import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    result = await db.execute(select(User).where((User.username == user_in.username) | (User.email == user_in.email)))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
        
    # Check if this is the first user; if so, make them admin!
    count_result = await db.execute(select(User))
    users_list = count_result.scalars().all()
    role = "admin" if len(users_list) == 0 else "user"
    
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where((User.username == credentials.username) | (User.email == credentials.username)))
    user = result.scalars().first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
        
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    access_token = create_access_token(subject=user.username)
    refresh_token = create_refresh_token(subject=user.username)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "role": user.role,
        "username": user.username
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(payload: TokenRefresh, db: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
        
    username = decoded.get("sub")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
        
    new_access = create_access_token(subject=user.username)
    new_refresh = create_refresh_token(subject=user.username)
    
    return {
        "access_token": new_access,
        "token_type": "bearer",
        "refresh_token": new_refresh,
        "role": user.role,
        "username": user.username
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
