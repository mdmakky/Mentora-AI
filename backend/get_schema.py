import json
import os
from supabase import create_client

supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))
res = supabase.table("question_generation_runs").select("*").limit(1).execute()
print(json.dumps(res.data))
