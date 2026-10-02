from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    tick: int = Field(ge=0, le=2250)
    order: int | None = Field(default=None, ge=0, le=100000)
    k: Literal["designate", "classify", "engage"]
    track: str = Field(pattern=r"^T[1-9][0-9]{0,2}$")
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
    execution_tick: int | None = Field(default=None, ge=0, le=2250)
    end_tick: int = Field(default=2250, ge=2250, le=2250)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class EmptyPayload(StrictModel):
    pass


class ContactPayload(StrictModel):
    kind: Literal["quad", "fiber_fpv"]
    bearing: int = Field(default=40, ge=0, lt=360)


class SwarmPayload(StrictModel):
    count: Literal[6] = 6
    bearing: int = Field(default=40, ge=0, lt=360)


class FaultPayload(StrictModel):
    sensor: Literal["radar", "rf"]
    mode: Literal["jammed", "failed"]

    @model_validator(mode="after")
    def rf_cannot_jam(self):
        if self.sensor == "rf" and self.mode != "failed":
            raise ValueError("RF supports failure or restoration")
        return self


class RestorePayload(StrictModel):
    sensor: Literal["radar", "rf"]


class EnvironmentPayload(StrictModel):
    night: bool


class CommandBase(StrictModel):
    command_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class PauseCommand(CommandBase):
    type: Literal["pause", "resume"]
    payload: EmptyPayload = Field(default_factory=EmptyPayload)


class ContactCommand(CommandBase):
    type: Literal["inject_contact"]
    payload: ContactPayload


class SwarmCommand(CommandBase):
    type: Literal["inject_swarm"]
    payload: SwarmPayload


class FaultCommand(CommandBase):
    type: Literal["sensor_fault"]
    payload: FaultPayload


class RestoreCommand(CommandBase):
    type: Literal["sensor_restore"]
    payload: RestorePayload


class EnvironmentCommand(CommandBase):
    type: Literal["environment"]
    payload: EnvironmentPayload


InstructorCommand = Annotated[PauseCommand | ContactCommand | SwarmCommand | FaultCommand | RestoreCommand | EnvironmentCommand, Field(discriminator="type")]


class CommandAck(StrictModel):
    seq: int = Field(ge=1, le=100)
    tick: int = Field(ge=0, le=2250)
    order: int = Field(ge=0, le=100000)


class ControlState(StrictModel):
    tick: int = Field(ge=0, le=2250)
    paused: bool
    active_contacts: int = Field(ge=0, le=72)
    radar_status: Literal["normal", "jammed", "failed"]
    rf_available: bool
    night: bool
    applied: list[CommandAck] = Field(default_factory=list, max_length=100)
