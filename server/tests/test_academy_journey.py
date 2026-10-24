"""Existing preparation contract exercised by the explicit competency journey.

Synthetic integration checks; no participant or learning efficacy claims.
"""
import pytest
from server.tests.test_api import client
from server.tests.test_learning import joined, prepared


@pytest.mark.parametrize('competency,form', [('C01', 'baseline-a'), ('C04', 'transfer-d')])
def test_journey_assessment_is_bound_to_selected_competency_and_form(client, competency, form):
    trainee = joined(client, 'JOURNEY-QA')
    catalogue = client.get('/api/v1/learning/catalogue').json()
    item = next(i for i in catalogue['items'] if i['competency_id'] == competency
                and i['pool'] == 'assessment' and i['form'] == form
                and i['audience'] == 'individual')
    request_id = 'journey-' + competency
    attempt = prepared(client, trainee, mode='assessment', rid=request_id,
                       item_id=item['id'], form=form)
    assert attempt['context']['item_id'] == item['id']
    assert attempt['context']['assistance'] == 'none'
    assert attempt['context']['mode'] == 'assessment'
    assert attempt['context']['selection']['candidates'] == [item['id']]
    assert prepared(client, trainee, mode='assessment', rid=request_id,
                    item_id=item['id'], form=form) == attempt
    mismatch = 'immediate-b' if form != 'immediate-b' else 'baseline-a'
    rejected = client.post('/api/v1/learning/prepare', json=dict(
        request_id='journey-mismatch-' + competency, trainee=trainee,
        mode='assessment', item_id=item['id'], form=mismatch, seed=7))
    assert rejected.status_code == 422
    progress = client.get(f'/api/v1/learning/trainees/{trainee}/progress').json()
    assert progress['assessed_attempts'] == progress['practice_attempts'] == 0
