import { EVALUATION_DATASET_VERSION } from './evaluation.dataset';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(__dirname,'../../../..');
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const fileHash=(name:string)=>hash(readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'));
export interface EvaluationProvenance {evaluationSchemaVersion:number;datasetVersion:number;datasetFingerprint:string;gitCommit:string;workingTreeDirty:boolean;sourceFingerprint:string;timestamp:string;agentPatternVersion:string;modelMode:'SIMULATED'|'LIVE';modelProvider:string|null;modelId:string|null;promptVersion:string;corpusFingerprint:string;corpusMode:'SYNTHETIC';retrievalConfigVersion:string;toolContractVersion:string;verificationFingerprint:string;intentFingerprint:string;approvalPolicyFingerprint:string;configurationFingerprint:string;}
export function provenance(dataset:unknown,mode:'SIMULATED'|'LIVE'='SIMULATED',provider:string|null=null,model:string|null=null,datasetVersion:number=EVALUATION_DATASET_VERSION):EvaluationProvenance{
 const sources:string[]=[];
 const walk=(dir:string)=>{for(const e of readdirSync(path.join(root,dir),{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory())walk(n);else if(/\.(ts|json)$/.test(n))sources.push(n);}};walk('backend/src');
 const git=(args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 return{evaluationSchemaVersion:2,datasetVersion,datasetFingerprint:hash(JSON.stringify(dataset)),gitCommit:git(['rev-parse','HEAD']),workingTreeDirty:!!git(['status','--porcelain']),sourceFingerprint:hash(sources.sort().map(n=>n+':'+fileHash(n)).join('\n')),timestamp:new Date().toISOString(),agentPatternVersion:fileHash('backend/src/ai/graph/hseAgent.runner.ts'),modelMode:mode,modelProvider:provider,modelId:model,promptVersion:fileHash('backend/src/ai/prompt.ts'),corpusFingerprint:fileHash(mode==='SIMULATED'?'backend/src/ai/evaluation/offline.executor.ts':'backend/src/ai/evaluation/evaluation.live-safe.cli.ts'),corpusMode:'SYNTHETIC',retrievalConfigVersion:hash('synthetic-retriever-v1:no-vector-search'),toolContractVersion:fileHash('backend/src/ai/tools.ts'),verificationFingerprint:hash(['backend/src/ai/graph/semanticVerifier.ts','backend/src/ai/graph/jurisdiction.contract.ts','backend/src/ai/graph/evidence.contract.ts','backend/src/ai/graph/nodes/verify.node.ts'].map(fileHash).join(':')),intentFingerprint:fileHash('backend/src/ai/intent/intentRouter.ts'),approvalPolicyFingerprint:fileHash('backend/src/ai/hitl/hitl.policy.ts'),configurationFingerprint:fileHash('backend/src/ai/config.ts')};
}

