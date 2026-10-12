import copy
import pytest
from server import engine,engine_v1_0_1 as frozen
from server.exercises import AuthorScenario,compile_authored

@pytest.mark.parametrize('scenario',[frozen.make_scenario(482913),compile_authored(AuthorScenario(name='Frozen compatibility',seed=11))])
def test_released_score_and_trace_are_identical(scenario):
    original=copy.deepcopy(scenario)
    a=engine.Simulation(scenario);b=frozen.Simulation(scenario)
    for _ in range(2250):
        a.step();b.step()
        if a.tick%75==0:assert a.tracks==b.tracks
    assert engine.score(a)==frozen.score(b)
    assert scenario==original
    assert engine.score(a)['engine_version'] in {'vyuha-0.2.0','vyuha-0.3.0'}

@pytest.mark.parametrize('version',['vyuha-999.0','unexpected'])
def test_unknown_engine_never_silently_replays(version):
    scenario=frozen.make_scenario(1);scenario['engine_version']=version
    with pytest.raises(ValueError,match='Unsupported'):engine.Simulation(scenario)
    with pytest.raises(ValueError,match='Unsupported'):engine.replay(scenario,[],2250)

@pytest.mark.parametrize('horizon',[2251,-1,False,1.5])
def test_invalid_horizon_terminates_with_explicit_error(horizon):
    with pytest.raises(ValueError,match='horizon'):engine.replay(frozen.make_scenario(1),[],horizon)
