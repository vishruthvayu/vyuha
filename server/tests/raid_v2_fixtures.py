"""Synthetic procedural/motion parity fixture; no human evaluation evidence."""
import json
from server.raid_v2 import FAMILIES,compose_raid,raid_position


def fixtures():
 cases=[]
 for i,family in enumerate(FAMILIES):
  scenario=compose_raid(dict(seed=19031+i,duration=180 if i%2 else 90,difficulty='challenging',family=family))
  tracks=[]
  for track in scenario['tracks']:
   ticks={0,track['spawn'],max(0,track['spawn']-1),scenario['duration']*30-1}
   ticks.update(range(track['spawn'],scenario['duration']*30,97))
   for phase in [track['motion']['phase_s'],track['motion']['period_s'],track.get('group_split_s',0)]:
    for offset in [-1,0,1]:ticks.add(max(0,min(scenario['duration']*30,track['spawn']+round(phase*30)+offset)))
   tracks.append(dict(track=track,positions=[dict(tick=tick,**raid_position(track,tick)) for tick in sorted(ticks)]))
  cases.append(dict(family=family,scenario=scenario,tracks=tracks))
 return cases


if __name__=='__main__':print(json.dumps(fixtures(),separators=(',',':')))
