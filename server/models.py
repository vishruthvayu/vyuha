from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    tick: int = Field(ge=0, le=2250)
    k: Literal["designate", "classify", "engage"]
    track: str = Field(pattern=r"^T[1-8]$")
    kind: Literal["bird", "quad", "fixed_wing", "fiber_fpv"] | None = None
    identity: Literal["hostile", "friendly", "neutral"] | None = None
    effector: Literal["rf_jam", "kinetic", "hold"] | None = None

    @model_validator(mode="after")
    def required_fields(self):
        if self.k == "classify" and (not self.kind or not self.identity):
            raise ValueError("Classification needs kind and identity")
        if self.k == "engage" and not self.effector:
            raise ValueError("Engagement needs an effector")
        if self.k != "classify" and (self.kind is not None or self.identity is not None):
            raise ValueError("Only classify actions carry classification fields")
        if self.k != "engage" and self.effector is not None:
            raise ValueError("Only engage actions carry an effector")
        return self


class Generate(BaseModel):
    seed: int = Field(default=482913, ge=0, le=4294967295)
    night: bool = True
    mode: Literal["scripted", "adaptive"] = "scripted"
    focus: Literal["recognition", "response"] | None = None
    trainee: str = Field(default="CADET-01", min_length=1, max_length=24, pattern=r"^[A-Za-z0-9_-]+$")


class CreateSession(BaseModel):
    scenario_id: str = Field(max_length=100)
    trainee: str = Field(default="CADET-01", min_length=1, max_length=24, pattern=r"^[A-Za-z0-9_-]+$")


class EventBatch(BaseModel):
    seq: int = Field(ge=0, le=10000)
    events: list[Action] = Field(max_length=2000)


class Complete(BaseModel):
    end_tick: int = Field(default=2250, ge=2250, le=2250)
