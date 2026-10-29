"""Site-preserving mission-v3 admission; unchanged evidence-assessment-v2 criteria."""
from . import observation_assessment as prior
from . import observation_assessment_v2 as v2
from .observation_missions_v3 import validate_mission
from .engine_v4 import replay


def contract(scenario):
    validate_mission(scenario)
    return scenario['observation_mission']


def assess_mission(scenario, actions, commands, sid, observed_end):
    site = scenario['training_site']['id']
    return prior.assess_mission(
        scenario, actions, commands, sid, observed_end,
        _contract=contract, _interpret=v2.interpret, _replay=replay,
        _version=v2.VERSION, _criteria=v2.CRITERIA,
        _limitations=v2.LIMITATIONS + [
            'Authored site geometry changes possible LOS, not the criterion definitions, sensor calibration or proof of human evidence use.'
        ], _follow_suffix=f'&mission_version=3&mission_site={site}')
