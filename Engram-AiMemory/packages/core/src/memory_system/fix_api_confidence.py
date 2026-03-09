import sys

content = open("api.py").read()

new_endpoints = """

@app.post("/memories/confidence-maintenance", dependencies=[Depends(require_auth)])
async def trigger_confidence_maintenance(tenant_id: str | None = None):
    \"\"\"Manually trigger confidence propagation and contradiction detection.\"\"\"
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")
    
    # Ideally trigger background worker logic here
    # We will trigger the background job method directly for demonstration
    global _scheduler
    if _scheduler:
        try:
            await _scheduler._job_confidence_maintenance()
            return {"status": "success", "message": "Confidence maintenance job triggered"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    return {"status": "error", "message": "Scheduler not available"}
"""

if "trigger_confidence_maintenance" not in content:
    content = content + new_endpoints
    open("api.py", "w").write(content)
    print("Added confidence maintenance endpoint")
