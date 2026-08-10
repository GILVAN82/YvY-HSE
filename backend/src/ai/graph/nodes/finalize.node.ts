import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, AgentErrorCode, type AgentRuntime } from '../hseAgent.types';
import { localized, type ResponseLanguage } from '../../responseLanguage';

const FAILURE_MESSAGES: Record<string, Record<ResponseLanguage, string>> = {
  [AgentErrorCode.EMPTY_ANSWER]: { en:'I could not produce an answer for this question.',pt:'Não consegui produzir uma resposta para esta pergunta.',es:'No pude producir una respuesta para esta pregunta.',fr:"Je n’ai pas pu produire de réponse à cette question.",de:'Ich konnte für diese Frage keine Antwort erstellen.' },
  [AgentErrorCode.STEP_LIMIT]: { en:'The query became too complex. Try a more specific question.',pt:'A consulta ficou complexa demais. Tente uma pergunta mais específica.',es:'La consulta resultó demasiado compleja. Intente una pregunta más específica.',fr:'La requête est devenue trop complexe. Essayez une question plus précise.',de:'Die Anfrage wurde zu komplex. Versuchen Sie eine spezifischere Frage.' },
  [AgentErrorCode.TOOL_FAILURE]: { en:'I could not query the system data right now.',pt:'Não consegui consultar os dados do sistema agora.',es:'No pude consultar los datos del sistema en este momento.',fr:"Je n’ai pas pu consulter les données du système pour le moment.",de:'Ich konnte die Systemdaten derzeit nicht abfragen.' },
  [AgentErrorCode.MODEL_ERROR]: { en:'I could not complete this query at this time.',pt:'Não consegui concluir esta consulta agora.',es:'No pude completar esta consulta en este momento.',fr:"Je n’ai pas pu terminer cette requête pour le moment.",de:'Ich konnte diese Anfrage derzeit nicht abschließen.' },
  [AgentErrorCode.TIMEOUT]: { en:'The query took too long and was stopped.',pt:'A consulta demorou demais e foi interrompida.',es:'La consulta tardó demasiado y fue interrumpida.',fr:'La requête a pris trop de temps et a été interrompue.',de:'Die Anfrage dauerte zu lange und wurde abgebrochen.' },
  [AgentErrorCode.PROVIDER_UNAVAILABLE]: { en:'The AI service is not configured on the server.',pt:'O serviço de IA não está configurado no servidor.',es:'El servicio de IA no está configurado en el servidor.',fr:"Le service d’IA n’est pas configuré sur le serveur.",de:'Der KI-Dienst ist auf dem Server nicht konfiguriert.' },
};

export async function finalizeNode(_state: HseAgentState): Promise<Partial<HseAgentState>> { return { status: AgentStatus.COMPLETED }; }

export async function finalizeFailureNode(state: HseAgentState, config: LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
  const runtime = config.configurable?.runtime as AgentRuntime | undefined;
  const code = state.errorCode ?? AgentErrorCode.MODEL_ERROR;
  const language = runtime?.responseLanguage ?? 'en';
  const templates = FAILURE_MESSAGES[code] ?? FAILURE_MESSAGES[AgentErrorCode.MODEL_ERROR];
  runtime?.emit({ type: 'error', message: localized(templates, language), code });
  return { status: AgentStatus.FAILED, errorCode: code };
}
