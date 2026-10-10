import { ProactiveVoiceQueue, type YvyVoiceQueueEntry } from './proactive-voice-queue';
import type { YvyAlert } from '../yvy-alert.service';

const alert=(id:string,severity:'HIGH'|'CRITICAL'):YvyAlert=>({id,severity,category:'OVERDUE_ACTION',title:'Alert',summary:'Verified summary',sourceType:'OPERATIONAL_DATA',sourceId:id,evidence:[],ruleId:'RULE',status:'ALERTED',createdAt:'2026-09-02T00:00:00Z',notificationCount:0});
const entry=(id:string,priority:'HIGH'|'CRITICAL'):YvyVoiceQueueEntry=>({id,priority,alert:alert(id,priority),spokenText:'Grounded alert.',language:'en'});

describe('ProactiveVoiceQueue',()=>{
 it('gives critical alerts priority without losing deterministic order',()=>{const q=new ProactiveVoiceQueue();q.enqueue(entry('h1','HIGH'));q.enqueue(entry('c1','CRITICAL'));q.enqueue(entry('h2','HIGH'));expect(q.shift()?.id).toBe('c1');expect(q.shift()?.id).toBe('h1');expect(q.shift()?.id).toBe('h2');});
 it('deduplicates the same claimed notification',()=>{const q=new ProactiveVoiceQueue();q.enqueue(entry('h1','HIGH'));q.enqueue(entry('h1','HIGH'));expect(q.size).toBe(1);});
 it('keeps queued speech pending until its consumer drains it',()=>{const q=new ProactiveVoiceQueue();q.enqueue(entry('h1','HIGH'));expect(q.peek()?.id).toBe('h1');expect(q.size).toBe(1);});
});
