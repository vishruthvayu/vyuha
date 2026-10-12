"""Optimized internal copying retains the full public mutable-isolation contract."""
import copy
import pytest
from server.sensors_v2 import _copy_sensor_memory, _copy_sensor_position


def memory():
    return dict(key='1:0:T1',tick=60,sweep=2,paints=[True,False,True],misses=0,
                confirmed=True,position=dict(x=10.0,z=20.0,altitude=30.0),
                sample_tick=60,radar_status='normal',last_state='confirmed')


def test_internal_memory_and_returned_radar_position_detach_all_mutable_fields():
    original=memory();before=copy.deepcopy(original);result=_copy_sensor_memory(original)
    assert result==before and result is not original
    point=_copy_sensor_position(result['position'])
    result['paints'].append(False);result['position']['x']=99;point['z']=77
    assert original==before and result['position']['z']==20


@pytest.mark.parametrize('extension',[
    {'metadata':{'nested':[{'value':1}]}},
    {'position':{'x':1,'z':2,'altitude':3,'extra':{'nested':[1]}}},
    {'paints':[{'nested':[True]}]},
    {'last_state':{'nested':[1]}},
])
def test_extended_public_memory_keeps_deepcopy_behavior(extension):
    original=memory();original.update(extension);before=copy.deepcopy(original)
    result=_copy_sensor_memory(original)
    assert result==before
    # Changing nested extension data never changes caller-owned memory.
    def mutate(value):
        if isinstance(value,dict):
            for item in value.values():mutate(item)
        elif isinstance(value,list):value.append('changed')
    mutate(result);assert original==before


def test_incomplete_memory_is_not_silently_repaired_by_optimization():
    original=memory();del original['position']
    result=_copy_sensor_memory(original)
    assert result==original and 'position' not in result


def test_position_extension_is_detached_and_preserved():
    original=dict(x=1,z=2,altitude=3,extension={'path':[1,2]})
    result=_copy_sensor_position(original);assert result==original
    result['extension']['path'].append(3);assert original['extension']['path']==[1,2]
