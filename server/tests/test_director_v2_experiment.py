import pytest
from server.director_v2_experiment import experiment, run_learner, render_report


def test_synthetic_policy_traces_are_repeatable_and_change_with_seed():
    for policy in ['v1_thompson','v2_adjusted']:
        a=run_learner(123,policy,'plastic_moderate_forgetting',12)
        assert run_learner(123,policy,'plastic_moderate_forgetting',12)==a
        assert run_learner(124,policy,'plastic_moderate_forgetting',12)['trace_sha256']!=a['trace_sha256']
        assert 0<=a['training_contact_success']<=1 and .05<=a['final_latent_mastery']<=.95
        assert sum(a['focus_counts'].values())==sum(a['difficulty_counts'].values())==12


def test_stationary_control_does_not_mistake_easier_tasks_for_learning():
    a=run_learner(124,'v1_thompson','stationary',16)
    b=run_learner(124,'v2_adjusted','stationary',16)
    assert a['initial_latent_mastery']==a['final_latent_mastery']==b['final_latent_mastery']
    # Correct response fractions are sampled on policy-selected task difficulties.
    assert a['difficulty_counts']!=b['difficulty_counts']


def test_comparison_reports_all_regimes_and_does_not_require_v2_to_win():
    result=experiment(seeds=3,sessions=10)
    assert len(result['runs'])==18
    assert len(result['summaries'])==3
    assert result['summaries']['stationary']['paired_latent_mastery_difference']==0
    assert result['summaries']['stationary']['approximate_normal_95_interval']==[0,0]
    report=render_report(result)
    assert 'no demonstrated human learning benefit' in report
    assert 'Do not select only a favourable regime' in report
    assert 'does not run the 3D simulator' in report


@pytest.mark.parametrize('kwargs',[dict(seeds=1),dict(sessions=0),dict(seeds=201)])
def test_experiment_size_is_bounded(kwargs):
    with pytest.raises(ValueError):experiment(**kwargs)
