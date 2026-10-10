import policies from './table-access-policy.json';
import type { RequestPrincipal } from './auth.types';
import { assertPermission, assertProjectAccess, AuthorizationError, denyAccess, hasPermission } from './authorization';

type Scope = {kind:'PROJECT_SCOPED_DIRECT';column:string} | {kind:'PROJECT_SCOPED_DERIVED';parent:string;key:string;parentKey:string;projectColumn:string} | {kind:'GLOBAL'} | {kind:'UNAVAILABLE_TO_AGENT'};
export interface TableAccessPolicy {scope:Scope;allowedForModel:string[];requiredForEvidence:string[];blocked:string[]}
export const quoteIdentifier = (name:string) => '"'+name.replace(/"/g,'""')+'"';
export function tablePolicy(table:string):TableAccessPolicy {
  const policy=(policies as unknown as Record<string,TableAccessPolicy>)[table];
  if(!policy)throw new AuthorizationError(undefined,'PROJECT_SCOPE_DENIED');
  return policy;
}

/** Explicitly global tables are public operational references; unknown scope is never global. */
export function tableScopeSql(table:string, allowed:readonly string[]|null, params:unknown[], project?:string):string {
  const s=tablePolicy(table).scope, row=quoteIdentifier(table);
  if(s.kind==='UNAVAILABLE_TO_AGENT') { if(allowed!==null || project)throw new AuthorizationError(undefined,'PROJECT_SCOPE_DENIED'); return 'TRUE'; }
  if(s.kind==='GLOBAL') { if(project)throw new AuthorizationError(undefined,'PROJECT_SCOPE_DENIED'); return 'TRUE'; }
  if(project && allowed!==null && !allowed.includes(project))throw new AuthorizationError(undefined,'PROJECT_SCOPE_DENIED');
  const scope=project?[project]:allowed;
  if(s.kind==='PROJECT_SCOPED_DIRECT') {
    if(scope===null)return 'TRUE';params.push(scope);
    return `${row}.${quoteIdentifier(s.column)}=ANY($${params.length}::text[])`;
  }
  const join=`p.${quoteIdentifier(s.parentKey)}=${row}.${quoteIdentifier(s.key)}`;
  if(scope===null)return `EXISTS(SELECT 1 FROM ${quoteIdentifier(s.parent)} p WHERE ${join})`;
  params.push(scope);const ref=`$${params.length}::text[]`;
  return `(EXISTS(SELECT 1 FROM ${quoteIdentifier(s.parent)} p WHERE ${join}) AND NOT EXISTS(SELECT 1 FROM ${quoteIdentifier(s.parent)} p WHERE ${join} AND (p.${quoteIdentifier(s.projectColumn)} IS NULL OR NOT(p.${quoteIdentifier(s.projectColumn)}=ANY(${ref})))))`;
}

export function authorizeTable(principal:RequestPrincipal,table:string,operation:'read'|'write',forModel=false) {
  assertPermission(principal,operation==='write'?'HSE_DATA_WRITE':'HSE_DATA_READ',table,operation);
  const policy=tablePolicy(table);
  if(forModel && !policy.allowedForModel.length)denyAccess(principal,'AUTHORIZATION_DENIED',table,operation);
  if(policy.scope.kind==='UNAVAILABLE_TO_AGENT' && (!hasPermission(principal,'ADMIN_ACCESS')||forModel))denyAccess(principal,'PROJECT_SCOPE_DENIED',table,operation);
  if(operation==='write' && policy.scope.kind==='GLOBAL' && !hasPermission(principal,'ADMIN_ACCESS'))denyAccess(principal,'AUTHORIZATION_DENIED',table,operation);
  return policy;
}

export async function authorizeRecordWrite(db:{query:Function},principal:RequestPrincipal,table:string,values:Record<string,unknown>) {
  const {scope}=authorizeTable(principal,table,'write');
  if(scope.kind==='PROJECT_SCOPED_DIRECT') {
    if(typeof values[scope.column]!=='string'||!values[scope.column])denyAccess(principal,'PROJECT_SCOPE_DENIED',table,'write');
    assertProjectAccess(principal,values[scope.column] as string);
  } else if(scope.kind==='PROJECT_SCOPED_DERIVED') {
    const r=await db.query(`SELECT ${quoteIdentifier(scope.projectColumn)} AS project FROM ${quoteIdentifier(scope.parent)} WHERE ${quoteIdentifier(scope.parentKey)}=$1`,[values[scope.key]]);
    if(!r.rows.length)throw new AuthorizationError(undefined,'RESOURCE_NOT_FOUND');
    for(const row of r.rows) {if(!row.project)denyAccess(principal,'PROJECT_SCOPE_DENIED',table,'write');assertProjectAccess(principal,row.project);}
  }
}
