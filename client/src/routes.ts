export type Discoverability = 'NAVIGATED' | 'SECONDARY_REACHABLE' | 'INTENTIONALLY_HIDDEN';
export type WorkspaceView = 'drill' | 'aar' | 'unit';
export const navigationSections = ['Workspace', 'Unit', 'Exercises', 'Data / operations', 'System / evidence'] as const;

// Every renderer must have a policy. These are pages, not API or asset URLs.
export const routes = [
 {id:'training', path:'/', title:'Training ground', section:'Workspace', policy:'NAVIGATED', identity:true, status:'ACTIVE', audience:'Trainee', reason:'Primary tactical workspace; also contains review, profile and Director.'},
 {id:'rapid', path:'/rapid-id', title:'Rapid ID', section:'Workspace', policy:'NAVIGATED', identity:true, status:'ACTIVE', audience:'Trainee', reason:'Focused recognition practice.'},
 {id:'unit', path:'/unit', title:'Unit training overview', section:'Unit', policy:'NAVIGATED', identity:false, status:'ACTIVE', audience:'Officer / instructor', reason:'Unit profiles and completed session history.'},
 {id:'instructor', path:'/instructor', title:'Instructor console', section:'Unit', policy:'NAVIGATED', identity:false, status:'ACTIVE', audience:'Instructor', reason:'Independent session monitoring and commands.'},
 {id:'analytics', path:'/analytics', title:'Training analytics', section:'Unit', policy:'NAVIGATED', identity:true, status:'ACTIVE', audience:'Trainee / instructor', reason:'Persisted history, trends and embedded scenario-skill heatmap.'},
 {id:'exercises', path:'/exercises', title:'Exercise studio', section:'Exercises', policy:'NAVIGATED', identity:false, status:'ACTIVE', audience:'Instructor', reason:'Author, save and assign frozen exercises.'},
 {id:'recorded', path:'/recorded', title:'Recorded practice', section:'Exercises', policy:'NAVIGATED', identity:true, status:'EXPERIMENTAL', audience:'Trainee / instructor', reason:'Implemented bounded, unscored recorded-observation practice.'},
 {id:'transfer', path:'/transfer', title:'Data transfer', section:'Data / operations', policy:'NAVIGATED', identity:false, status:'ACTIVE', audience:'Officer / data operator', reason:'Export/import HMAC bundles; needs a configured shared key for transfer.'},
 {id:'evidence', path:'/system/evidence', title:'System evidence', section:'System / evidence', policy:'NAVIGATED', identity:false, status:'ACTIVE', audience:'All / reviewer', reason:'Measured validation evidence and limitations.'},
 {id:'evaluation', path:'/evaluation', title:'Informal evaluation', section:null, policy:'SECONDARY_REACHABLE', identity:true, status:'EXPERIMENTAL', audience:'Consenting pilot participant / facilitator', parent:'/rapid-id', reason:'Opt-in pilot protocol via Rapid ID; not a routine drill or an efficacy claim.'},
 {id:'benchmark', path:'/system/benchmark', title:'Device performance check', section:null, policy:'SECONDARY_REACHABLE', identity:false, status:'INTERNAL', audience:'Operator / engineering', parent:'/system/evidence', reason:'Engineering measurement via System evidence; avoid a frequent-workflow sidebar entry.'},
] as const;
export type PageId = typeof routes[number]['id'];
export type NavigationId = PageId | 'review' | 'director';
export type NavigationItem = {id:NavigationId; href:string; label:string; section:typeof navigationSections[number]; workspace?:WorkspaceView; workspaceHref?:string};

export const navigationItems: readonly NavigationItem[] = ([
 ...routes.filter(r=>r.policy==='NAVIGATED').map(r=>({id:r.id, href:r.path, label:r.title, section:r.section!, ...(r.id==='unit'?{workspace:'unit' as const,workspaceHref:'/?view=unit'}:{})})),
 {id:'review', href:'/?view=aar', label:'After-action review', section:'Workspace', workspace:'aar'},
 {id:'director', href:'/?mode=adaptive', label:'Adaptive Director', section:'Workspace', workspace:'drill'},
] satisfies NavigationItem[]).sort((a,b)=>{
 const order:NavigationId[]=['training','review','rapid','director','unit','instructor','analytics','exercises','recorded','transfer','evidence'];
 return order.indexOf(a.id)-order.indexOf(b.id);
});

export function normalisePath(path:string){return path==='/'?'/':path.replace(/\/+$/,'');}
export function resolveRoute(path:string){return routes.find(r=>r.path===normalisePath(path));}
export function workspaceViewFromSearch(search:string):WorkspaceView{
 const params=new URLSearchParams(search);
 if(params.get('session'))return 'aar';
 return params.get('view')==='aar'?'aar':params.get('view')==='unit'?'unit':'drill';
}
export function activeNavigation(path:string,search='',view?:WorkspaceView):NavigationId|undefined{
 const route=resolveRoute(path);
 if(!route)return undefined;
 if(route.id==='training'){
  const current=view??workspaceViewFromSearch(search);
  if(current==='aar')return 'review';
  if(current==='unit')return 'unit';
  return new URLSearchParams(search).get('mode')==='adaptive'?'director':'training';
 }
 // Secondary tools keep their parent workflow highlighted, with aria-current=location.
 if(route.policy==='SECONDARY_REACHABLE')return resolveRoute(route.parent)?.id;
 return route.id;
}

export function workspaceHref(view:WorkspaceView,search='',verifiedSession?:string){
 const params=new URLSearchParams(search);
 if(view==='aar'){
  params.set('view','aar');
  if(verifiedSession)params.set('session',verifiedSession);
 }else{
  params.delete('session');
  if(view==='unit')params.set('view','unit');else params.delete('view');
 }
 return '/'+(params.size?'?'+params.toString():'');
}
