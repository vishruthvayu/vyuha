export type Quality='high'|'medium'|'low'|'tactical';
export function lowerQuality(q:Quality):Quality{return q==='high'?'medium':q==='medium'?'low':'tactical';}
export const pixelRatio:Record<Quality,number>={high:1.5,medium:1,low:.75,tactical:1};
export function qualityAfterSamples(tier:Quality,samples:number[]){return samples.length>=3&&samples.slice(-3).every(f=>f<20)?lowerQuality(tier):tier;}
