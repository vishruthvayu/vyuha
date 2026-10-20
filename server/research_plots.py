"""Validate evaluation reliability panels; optional plotting never changes models."""
import csv,math
from pathlib import Path
from .data_validation import read_json

def panels(report):
    if not isinstance(report,dict) or report.get('schema_version')!=1 or not isinstance(report.get('strata'),dict):raise ValueError('Expected version1 evaluation report')
    if not isinstance(report.get('evidence_status'),str) or not report['evidence_status']:raise ValueError('Evaluation evidence status is required')
    result={}
    for kind,stratum in report['strata'].items():
        if kind not in {'real','synthetic','augmented_real'}:raise ValueError('Unknown source stratum')
        if not isinstance(stratum,dict) or not isinstance(stratum.get('metrics'),dict):raise ValueError('Invalid stratum metrics')
        bins=stratum['metrics'].get('reliability',[])
        if not isinstance(bins,list):raise ValueError('Reliability bins must be a list')
        rows=[]
        for item in bins:
            if not isinstance(item,dict):raise ValueError('Reliability bin must be an object')
            if type(item.get('count')) is not int or item['count']<0:raise ValueError('Invalid reliability denominator')
            for field in ['lower','upper']:
                v=item.get(field)
                if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1:raise ValueError('Invalid confidence interval boundary')
            if item['lower']>=item['upper']:raise ValueError('Reversed confidence bin')
            if item['count']:
                for field in ['mean_confidence','accuracy']:
                    v=item.get(field)
                    if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1:raise ValueError('Invalid reliability measurement')
                rows.append({k:item[k] for k in ['lower','upper','count','mean_confidence','accuracy']})
        if rows:result[kind]=rows
    if not result:raise ValueError('No populated classification reliability bins; detection/study reports need their own defined plot')
    return result

def render(report_path,output_directory):
    report_path=Path(report_path).resolve();output_directory=Path(output_directory).resolve()
    report=read_json(report_path);data=panels(report)
    destinations=[output_directory/(kind+suffix) for kind in data for suffix in ['-reliability.png','-reliability.csv']]
    if report_path in destinations:raise ValueError('Plot output cannot overwrite its input report')
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError as error:raise ValueError('Install the optional research plotting lock; core evaluation needs no plotting dependency') from error
    output_directory.mkdir(parents=True,exist_ok=True)
    artifacts=[]
    for kind,rows in data.items():
        prefix=output_directory/(kind+'-reliability')
        with prefix.with_suffix('.csv').open('w',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=['lower','upper','count','mean_confidence','accuracy']);writer.writeheader();writer.writerows(rows)
        fig,ax=plt.subplots(figsize=(6.5,5))
        fig.subplots_adjust(bottom=.2,top=.9,left=.14,right=.98)
        ax.plot([0,1],[0,1],color='gray',linestyle='--',label='Identity reference')
        ax.scatter([x['mean_confidence'] for x in rows],[x['accuracy'] for x in rows],s=[40+min(x['count'],200) for x in rows],label='Observed bin means')
        for x in rows:ax.annotate('n='+str(x['count']),(x['mean_confidence'],x['accuracy']),xytext=(6,-13),textcoords='offset points')
        ax.set(xlim=(-.02,1.02),ylim=(-.02,1.02),xlabel='Mean declared confidence',ylabel='Observed conditional accuracy',title=kind.upper()+' export — reliability bins')
        ax.legend(loc='lower right');ax.grid(alpha=.2)
        fig.text(.5,.035,'Source strata remain separate. No calibration or human-benefit certification.',ha='center',fontsize=7)
        fig.savefig(prefix.with_suffix('.png'),dpi=150);plt.close(fig)
        artifacts.extend([str(prefix.with_suffix('.png')),str(prefix.with_suffix('.csv'))])
    return dict(evidence_status=report['evidence_status'],artifacts=artifacts,real_and_synthetic_pooled=False,matplotlib_version=matplotlib.__version__,model_writes=False)
