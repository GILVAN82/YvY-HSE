import type { YvyAlert } from '../yvy-alert.service';
export type YvyVoicePriority='NORMAL'|'HIGH'|'CRITICAL';
export interface YvyVoiceQueueEntry{coveredAlerts?:YvyAlert[];id:string;priority:YvyVoicePriority;alert:YvyAlert;spokenText:string;language:'en'|'pt'|'es'|'fr'|'de';}
const rank:Record<YvyVoicePriority,number>={CRITICAL:0,HIGH:1,NORMAL:2};
export class ProactiveVoiceQueue{
 private entries:YvyVoiceQueueEntry[]=[];
 enqueue(entry:YvyVoiceQueueEntry){if(this.entries.some(item=>item.id===entry.id))return;this.entries.push(entry);this.entries.sort((a,b)=>rank[a.priority]-rank[b.priority]);}
 peek(){return this.entries[0]??null;}
 shift(){return this.entries.shift()??null;}
 get size(){return this.entries.length;}
 clear(){this.entries=[];}
}
