from supabase import create_client, Client
from core.config import get_settings

settings = get_settings()

# Supabase client with anon key (for auth operations)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Supabase client with service role key (for admin operations - bypasses RLS)
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase() -> Client:
    """Get Supabase client for regular operations."""
    return supabase


def get_supabase_admin() -> Client:
    """Get Supabase admin client (bypasses RLS)."""
    return supabase_admin
