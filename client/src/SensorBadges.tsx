import type {Snapshot} from './types';
import {sensorLabels} from './presentation';
export function SensorBadges({state}:{state:Pick<Snapshot,'radarStatus'|'rfAvailable'>}){const labels=sensorLabels(state);return <div className="sensor-badges" aria-label="Sensor availability">{Object.entries(labels).map(([sensor,label])=><span key={sensor} className={`sensor-badge ${label.toLowerCase()}`}><small>{sensor.toUpperCase()}</small><b>{label}</b></span>)}</div>;}
