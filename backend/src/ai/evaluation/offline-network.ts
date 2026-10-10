import { Socket } from 'node:net';
/** Process-local CLI/test guard. No concurrent live work may run inside this boundary. */
export async function withoutNetwork<T>(run:()=>Promise<T>):Promise<T>{
 const connect=Socket.prototype.connect;const fetch=globalThis.fetch;
 Socket.prototype.connect=function(){throw new Error('OFFLINE_NETWORK_FORBIDDEN');} as typeof connect;
 globalThis.fetch=async()=>{throw new Error('OFFLINE_NETWORK_FORBIDDEN');};
 try{return await run();}finally{Socket.prototype.connect=connect;globalThis.fetch=fetch;}
}
