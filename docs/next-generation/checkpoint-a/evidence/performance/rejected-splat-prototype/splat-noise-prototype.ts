import { valueNoise } from './terrain';
/** Compile the existing separable FBM sample grid. Float64 values and operation
 * order preserve every sample; only repeated coordinate/hash work is removed.
 * Local scratch arrays die after a texture build; no unbounded global cache. */
export function compileSplatNoise(resolution:number,size:number,wavelength:number,offsetX:number,offsetZ:number,octaves:number) {
 if(!Number.isInteger(resolution)||resolution<1||resolution>2048||!Number.isFinite(size)||size<=0||!Number.isFinite(wavelength)||wavelength<=0||!Number.isFinite(offsetX)||!Number.isFinite(offsetZ)||!Number.isInteger(octaves)||octaves<1||octaves>8)throw new RangeError('Unsupported procedural sample grid');
 const scale=resolution/size;
 const layers:{xs:Uint32Array;ys:Uint32Array;u:Float64Array;v:Float64Array;values:Float64Array;width:number;amp:number}[]=[];
 let frequency=1,amplitude=.5,norm=0,totalCells=0;
 for(let octave=0;octave<octaves;octave++) {
  const rawX=new Float64Array(resolution),rawY=new Float64Array(resolution),u=new Float64Array(resolution),v=new Float64Array(resolution);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<resolution;i++) {
   const x=((i/scale-size/2)/wavelength+offsetX)*frequency;
   const y=((size/2-i/scale)/wavelength+offsetZ)*frequency;
   const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
   rawX[i]=xi;rawY[i]=yi;u[i]=xf*xf*(3-2*xf);v[i]=yf*yf*(3-2*yf);
   minX=Math.min(minX,xi);maxX=Math.max(maxX,xi);minY=Math.min(minY,yi);maxY=Math.max(maxY,yi);
  }
  const width=maxX-minX+2,height=maxY-minY+2,cells=width*height;
  totalCells+=cells;if(!Number.isSafeInteger(cells)||totalCells>1000000)throw new RangeError('Procedural lattice exceeds bounded budget');
  const values=new Float64Array(cells),xs=new Uint32Array(resolution),ys=new Uint32Array(resolution);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)values[y*width+x]=valueNoise(minX+x,minY+y);
  for(let i=0;i<resolution;i++){xs[i]=rawX[i]-minX;ys[i]=rawY[i]-minY;}
  layers.push({xs,ys,u,v,values,width,amp:amplitude});norm+=amplitude;amplitude*=.5;frequency*=2.03;
 }
 return (px:number,py:number)=> {
  let sum=0;
  for(const layer of layers){const index=layer.ys[py]*layer.width+layer.xs[px],a=layer.values[index],b=layer.values[index+1],c=layer.values[index+layer.width],d=layer.values[index+layer.width+1],u=layer.u[px],v=layer.v[py];sum+=(a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*layer.amp;}
  return sum/norm;
 };
}
