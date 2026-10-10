import type { Pool, PoolClient } from 'pg';
const ATTENTION_LOCK_KEY=981_516_001;
export async function acquireAttentionLock(pool:Pick<Pool,'connect'>):Promise<PoolClient|null> {
  const client=await pool.connect();
  try {
    const result=await client.query('SELECT pg_try_advisory_lock($1) acquired',[ATTENTION_LOCK_KEY]);
    if(result.rows[0]?.acquired===true)return client;
    client.release();return null;
  } catch(error) {client.release(true);throw error;}
}
export async function releaseAttentionLock(client:PoolClient) {
  try {await client.query('SELECT pg_advisory_unlock($1)',[ATTENTION_LOCK_KEY]);client.release();}
  catch(error){client.release(true);throw error;}
}
export async function withAttentionLock<T>(pool:Pick<Pool,'connect'>,work:()=>Promise<T>):Promise<{status:'BUSY'}|{status:'COMPLETED';result:T}> {
  const client=await acquireAttentionLock(pool);if(!client)return {status:'BUSY'};
  try{return {status:'COMPLETED',result:await work()};}finally{await releaseAttentionLock(client);}
}
