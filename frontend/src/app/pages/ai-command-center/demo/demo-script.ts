export interface DemoStep {
  id: 'INTRODUCTION'|'TOOL_CALLING'|'RAG'|'MEMORY'|'HITL'|'CLOSING'; title: string; purpose: string;
  narration?: string; prompts?: string[]; expectedCapability?: string; timeoutMs: number;
  fallbackMessage: string; requiresHumanAction?: boolean; requirements: string[]; cue: string; targetSeconds: number;
}
const fallbackMessage='This demonstration step could not be completed. You can retry or skip; no successful result is implied.';
export const DEMO_STEPS: readonly DemoStep[] = [
  {id:'INTRODUCTION',title:'Introduction',purpose:'Problem and purpose',targetSeconds:45,timeoutMs:60000,fallbackMessage,
    narration:"Hello. I'm YvY, an AI agent and HSE work companion created by Gilvan Amorim. I help HSE professionals work with operational information, approved safety knowledge, evidence and human-controlled critical decisions. HSE information is often spread across records, procedures and different systems. My role is to bring that information together in a traceable and controlled way.",requirements:['Problem / purpose'],cue:'Explain the problem in one sentence, then why a State Graph was chosen over pure ReAct. Target: 20 seconds.'},
  {id:'TOOL_CALLING',title:'Tool Calling',purpose:'Current operational information',targetSeconds:60,timeoutMs:90000,fallbackMessage,
    prompts:['Show the current operational overview.'],expectedCapability:'OPERATIONAL_OVERVIEW',requirements:['Tool integration','Function calling'],cue:'Explain deterministic controls around model tool choice. Target: 20 seconds.'},
  {id:'RAG',title:'RAG + Citation',purpose:'Approved guidance and evidence',targetSeconds:60,timeoutMs:90000,fallbackMessage,
    prompts:['What does LOTO guidance require for energy control? Answer in exactly two short sentences grounded in the retrieved source. End EACH sentence with the exact citationLabel from the retrieved evidence in square brackets, before the final period. No headings, bullet points, introduction, or approval decision.'],expectedCapability:'search_hse_knowledge',requirements:['Learning application','Grounding'],cue:'Explain hybrid retrieval, RRF and abstention. Scores are bounded to the approved corpus. Target: 20 seconds.'},
  {id:'MEMORY',title:'Memory',purpose:'Two turns in the same owned conversation',targetSeconds:60,timeoutMs:150000,fallbackMessage,
    prompts:['Show open actions.', 'Show evidence.'],expectedCapability:'list_actions',requirements:['Advanced agent execution'],cue:'Explain short-term versus explicit long-term memory. Memory is untrusted context. Target: 20 seconds.'},
  {id:'HITL',title:'Human Approval',purpose:'Digital human control of a critical request',targetSeconds:60,timeoutMs:90000,fallbackMessage,
    expectedCapability:'LOTO_SAFETY_EXECUTION',requiresHumanAction:true,requirements:['Advanced execution','Ethics / human oversight'],cue:'Explain why safety-critical authority remains human. Digital approval is not physical verification. Target: 20 seconds.'},
  {id:'CLOSING',title:'Closing',purpose:'Trust and evaluation boundaries',targetSeconds:40,timeoutMs:60000,fallbackMessage,
    narration:'This presentation is not autonomous HSE decision-making. I combine operational tools, approved knowledge retrieval, evidence verification, controlled memory and human approval. When evidence is insufficient, I can abstain. When a decision is safety-critical, authority stays with people. My purpose is to support more traceable and better-informed HSE work, not to replace the professional responsible for the decision.',requirements:['Ethics / impact'],cue:'Explain that 44/44 is bounded behavioral evaluation, not universal LLM accuracy. Target: 20 seconds.'},
];
