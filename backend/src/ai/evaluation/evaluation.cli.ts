import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { withoutNetwork } from './offline-network';
import fs from 'node:fs/promises';
import path from 'node:path';
import { YVY_HSE_EVALUATION_CASES } from './evaluation.dataset';
import { runEvaluationHarness } from './evaluation.harness';
import { executeOffline } from './offline.executor';
import { provenance } from './evaluation.provenance';
import { assertSafeEvaluationReport, renderEvaluationMarkdown } from './evaluation.report';
import { INTENT_EVALUATION_DATASET, INTENT_DATASET_VERSION } from '../intent/intentEvaluation.dataset';
import { classifyIntent } from '../intent/intentRouter';
import type { EvaluationCase } from './evaluation.types';
export const supplemental:EvaluationCase[]=[
 {id:'zero-actions',version:1,category:'ZERO_RESULT',title:'Successful empty actions query',input:'Which actions are overdue?',expectation:{responseStatus:'NO_DATA',expectedOperationalFact:0,fabricatedOperationalRecords:0},evidenceNote:'Real graph and tool with empty fake DB'},
 {id:'zero-incidents',version:1,category:'ZERO_RESULT',title:'Successful empty incidents query',input:'How many open incidents are there?',expectation:{responseStatus:'NO_DATA',expectedOperationalFact:0,fabricatedOperationalRecords:0},evidenceNote:'Real graph and tool with empty fake DB'},
 {id:'authorization-cross-project',version:1,category:'AUTHORIZATION',title:'LOTO project denied',input:'Resolve LOTO in PRJ-B with PRJ-A permission.',expectation:{errorCode:'PROJECT_SCOPE_DENIED',approvalStatus:'PENDING',hitlBypassed:false},evidenceNote:'Real approval service with fake repository'},
];
async function main(){
 const report=await runEvaluationHarness(YVY_HSE_EVALUATION_CASES,executeOffline);
 report.provenance=provenance(YVY_HSE_EVALUATION_CASES);
 const supplementary=await runEvaluationHarness(supplemental,executeOffline);
 const intents=INTENT_EVALUATION_DATASET.map((item,index)=>({index,input:item.input,expected:item.expectedIntent,actual:classifyIntent(item.input).intent}));
 const intentSummary={datasetVersion:INTENT_DATASET_VERSION,total:intents.length,passed:intents.filter(i=>i.expected===i.actual).length,divergences:intents.filter(i=>i.expected!==i.actual)};
 assertSafeEvaluationReport(report);
 const artifact={...report,supplementary,intentSummary,reproduction:undefined as undefined|{patch:string;sha256:string;baseCommit:string}};
 const out=path.resolve(__dirname,'../../../../artifacts/evaluation');await fs.mkdir(out,{recursive:true});
 const name=`${report.provenance.timestamp.replace(/[:.]/g,'-')}-${report.provenance.gitCommit.slice(0,12)}-offline`;
 if(process.argv.includes('--reproduction-patch')){const patch=execFileSync('git',['diff','HEAD','--binary','--','backend/src','backend/package.json'],{cwd:path.resolve(out,'../..')});artifact.reproduction={patch:name+'.patch',sha256:createHash('sha256').update(patch).digest('hex'),baseCommit:report.provenance.gitCommit};await fs.writeFile(path.join(out,name+'.patch'),patch,{flag:'wx'});}
 await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(artifact,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 await fs.writeFile(path.join(out,name+'.md'),renderEvaluationMarkdown(report),{encoding:'utf8',flag:'wx'});
 await fs.writeFile(path.join(out,'offline-latest.json'),JSON.stringify({artifact:name+'.json'},null,2)+'\n');
 console.log(JSON.stringify({artifact:name,total:report.total,passed:report.passed,failed:report.failed,supplementary:{passed:supplementary.passed,total:supplementary.total},intentSummary},null,2));
 for(const r of report.results.filter(r=>!r.passed))console.log(r.caseId+': '+r.checks.filter(c=>!c.passed).map(c=>c.name+' '+c.evidence).join('; '));
 if(report.failed||supplementary.failed||intentSummary.divergences.length)process.exitCode=1;
}
if(require.main===module)void withoutNetwork(main).catch(()=>{console.error('OFFLINE EVALUATION INFRASTRUCTURE FAILURE');process.exitCode=2;});
