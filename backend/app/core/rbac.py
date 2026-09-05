from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT token from the Authorization header and extracts the user.
    Raises HTTP 401 if token is missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload missing user identifier ('sub').",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token was not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact hospital administrator.",
        )
    return user

def require_roles(allowed_roles: List[UserRole]):
    """
    Dependency factory to enforce Role-Based Access Control centrally.
    
    Why central dependency injection instead of inline checks?
    1. Guarantees uniform 403 Forbidden error structures across all endpoints.
    2. Keeps route handlers clean and focused purely on business logic.
    3. Self-documenting in OpenAPI/Swagger documentation.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = [r.value for r in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. This action requires one of the following roles: {', '.join(role_names)}. Current role: {current_user.role.value}.",
            )
        return current_user
    
    return role_checker

# Predefined role dependency shortcuts
require_admin = require_roles([UserRole.ADMIN])
require_doctor = require_roles([UserRole.DOCTOR])
require_nurse = require_roles([UserRole.NURSE])
require_doctor_or_admin = require_roles([UserRole.DOCTOR, UserRole.ADMIN])
require_clinical_staff = require_roles([UserRole.DOCTOR, UserRole.NURSE]) # Doctor or Nurse
require_any_authenticated = require_roles([UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE])
