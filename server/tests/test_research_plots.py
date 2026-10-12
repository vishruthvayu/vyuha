import copy
import pytest
from server.research_plots import panels

def report():return {'schema_version':1,'evidence_status':'SYNTHETIC_INTERFACE_EVALUATED','strata':{'synthetic':{'metrics':{'reliability':[{'lower':0,'upper':.5,'count':0,'mean_confidence':None,'accuracy':None},{'lower':.5,'upper':1,'count':4,'mean_confidence':.8,'accuracy':.75}]}}}}
def test_empty_bins_excluded_without_fabricated_zero_accuracy_and_sources_not_pooled():
    r=report();r['strata']['real']=copy.deepcopy(r['strata']['synthetic']);r['strata']['real']['metrics']['reliability'][1]['accuracy']=.25
    before=copy.deepcopy(r);out=panels(r)
    assert set(out)=={'real','synthetic'} and len(out['synthetic'])==1
    assert out['real'][0]['accuracy']==.25 and out['synthetic'][0]['accuracy']==.75
    assert r==before
@pytest.mark.parametrize('field,value',[('count',-1),('count',True),('accuracy',float('nan')),('accuracy',2),('mean_confidence',True),('lower',1)])
def test_malformed_reports_do_not_emit_plots(field,value):
    r=report();r['strata']['synthetic']['metrics']['reliability'][1][field]=value
    with pytest.raises(ValueError):panels(r)
def test_unknown_source_or_empty_detection_report_not_reinterpreted():
    with pytest.raises(ValueError):panels({'schema_version':1,'evidence_status':'SYNTHETIC_INTERFACE_EVALUATED','strata':{'fused':{}}})
    with pytest.raises(ValueError):panels({'schema_version':1,'evidence_status':'SYNTHETIC_INTERFACE_EVALUATED','strata':{'real':{'metrics':{'pd':1}}}})

@pytest.mark.parametrize('value',[None,[],{'schema_version':1,'strata':{}}, {'schema_version':1,'evidence_status':'test','strata':{'real':{'metrics':[]}}}, {'schema_version':1,'evidence_status':'test','strata':{'real':{'metrics':{'reliability':[None]}}}}])
def test_invalid_containers_reject_cleanly(value):
    with pytest.raises(ValueError):panels(value)
