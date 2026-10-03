from pydantic import Field
from .models import StrictModel

class JoinUnit(StrictModel):
    request_id: str | None = Field(default=None,min_length=1,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
    unit_id: str = Field(default='local',pattern=r'^[A-Za-z0-9_-]{1,40}$')
    callsign: str = Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
    trainee_id: str | None = Field(default=None,max_length=24)

class Presence(StrictModel):
    client_id: str = Field(min_length=1,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
    session_id: str | None = Field(default=None,max_length=64)

class GroupLaunch(StrictModel):
    scenario_id: str | None = Field(default=None,max_length=100)
    request_id: str = Field(min_length=1,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
    trainees: list[str] = Field(min_length=1,max_length=12)
    seed: int = Field(default=482913,ge=0,le=4294967295)
    night: bool = True

class AcceptAssignment(StrictModel):
    trainee_id: str = Field(min_length=1,max_length=24)
