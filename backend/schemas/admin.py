from pydantic import BaseModel, Field
from typing import Optional, List


class AdminStatsResponse(BaseModel):
    total_users: int = 0
    verified_users: int = 0
    unverified_users: int = 0
    total_documents: int = 0
    quarantined_pending: int = 0
    suspended_users: int = 0
    active_sessions_24h: int = 0
    daily_registrations: list = []


class AdminUserListParams(BaseModel):
    page: int = 1
    per_page: int = 20
    search: Optional[str] = None
    filter: Optional[str] = None  # all | suspended | high_warning | unverified


class AdminUserAction(BaseModel):
    action: str  # suspend | unsuspend | reset_warnings | verify_email | delete
    reason: Optional[str] = None


class AdminDocumentAction(BaseModel):
    action: str  # approve | reject_warn | reject_suspend
    reason: Optional[str] = None


class AdminBulkDocumentAction(BaseModel):
    document_ids: List[str]
    action: str  # approve | reject_warn | reject_suspend


class AdminLogResponse(BaseModel):
    id: str
    admin_id: str
    action_type: str
    target_type: str
    target_id: str
    details: Optional[dict] = None
    created_at: Optional[str] = None
    admin_email: Optional[str] = None
