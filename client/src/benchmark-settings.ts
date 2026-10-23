import type { Quality } from './quality';
import type { CameraPreset, ThermalPalette } from './presentation';
import type { Vision } from './visibility';
export function benchmarkSettings(search:string) {
 const p=new URLSearchParams(search);
 const choose=<T extends string>(key:string,values:readonly T[],fallback:T):T=>{const v=p.get(key);return values.includes(v as T)?v as T:fallback;};
 const engine=choose('engine',['finale','legacy'] as const,'finale');
 const count=Number(choose('contacts',['8','25','50','100','200'] as const,'8'));
 const duration=Number(choose('seconds',engine==='finale'?['20','60','180'] as const:['20','60'] as const,'20'));
 return {engine,count,duration,retained:engine==='finale'&&p.get('retained')==='1',tier:choose<Quality>('graphics',['high','medium','low','tactical'],'medium'),auto:p.get('auto')==='1',world:choose('world',['rural_forward_base','urban_outpost'] as const,'rural_forward_base'),night:p.get('night')!=='0',vision:choose<Vision>('view',['thermal','day','night'],'thermal'),palette:choose<ThermalPalette>('palette',['white','black','amber'],'white'),camera:choose<CameraPreset|'trainee'>('camera',['trainee','overview','observer','follow'],'trainee')};
}
export function benchmarkLink(s:ReturnType<typeof benchmarkSettings>) {
 const p=new URLSearchParams({diagnostics:'1',engine:s.engine,contacts:String(s.count),seconds:String(s.duration),retained:s.retained?'1':'0',graphics:s.tier,auto:s.auto?'1':'0',world:s.world,night:s.night?'1':'0',view:s.vision,palette:s.palette,camera:s.camera});
 return '/system/benchmark?'+p.toString();
}
