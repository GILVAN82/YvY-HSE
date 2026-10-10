import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, RefusalCode, type AgentRuntime } from '../hseAgent.types';
import { localized, resolveResponseLanguage, type ResponseLanguage } from '../../responseLanguage';

const COMMON_MESSAGES: Record<string, Record<ResponseLanguage, string>> = {
  [RefusalCode.EMPTY_INPUT]: { en:'Please send a question so I can help.',pt:'Envie uma pergunta para eu poder ajudar.',es:'Envíe una pregunta para que pueda ayudar.',fr:'Envoyez une question afin que je puisse vous aider.',de:'Bitte stellen Sie eine Frage, damit ich helfen kann.' },
  [RefusalCode.TOO_LONG]: { en:'This message is too long. Summarize the question and try again.',pt:'Esta mensagem é longa demais. Resuma a pergunta e tente novamente.',es:'Este mensaje es demasiado largo. Resuma la pregunta e inténtelo de nuevo.',fr:'Ce message est trop long. Résumez la question et réessayez.',de:'Diese Nachricht ist zu lang. Fassen Sie die Frage zusammen und versuchen Sie es erneut.' },
  [RefusalCode.PROMPT_INJECTION]: {
    en:"This request cannot be completed because it conflicts with the YVY HSE agent's safety rules. I can't reveal protected instructions or bypass the agent's controls.",
    pt:'Esta solicitação não pode ser atendida porque entra em conflito com as regras de segurança do agente YVY HSE. Não posso revelar instruções protegidas nem contornar os controles do agente.',
    es:'Esta solicitud no puede completarse porque entra en conflicto con las reglas de seguridad del agente YVY HSE. No puedo revelar instrucciones protegidas ni eludir los controles del agente.',
    fr:"Cette demande ne peut pas être traitée car elle entre en conflit avec les règles de sécurité et de périmètre de l’agent YVY HSE. Je peux aider sur les sujets HSE/QHSE et liés au système.",
    de:'Diese Anfrage kann nicht bearbeitet werden, da sie den Sicherheits- und Bereichsregeln des YVY-HSE-Agenten widerspricht. Ich kann bei HSE/QHSE- und systembezogenen Themen helfen.',
  },
  [RefusalCode.SECRET_MEMORY_REJECTION]: {
    en:"For security reasons, I can't store API keys, passwords, access tokens, or other credentials in long-term memory. Please keep secrets in a secure credential manager or environment configuration instead.",
    pt:'Por motivos de segurança, não posso armazenar chaves de API, senhas, tokens de acesso ou outras credenciais na memória de longo prazo. Mantenha esse tipo de informação em um gestor de credenciais ou na configuração segura do ambiente.',
    es:'Por motivos de seguridad, no puedo almacenar claves de API, contraseñas, tokens de acceso u otras credenciales en la memoria a largo plazo. Mantén este tipo de información en un gestor de credenciales o en una configuración segura del entorno.',
    fr:"Pour des raisons de sécurité, je ne peux pas stocker de clés API, mots de passe, jetons d'accès ou autres identifiants dans la mémoire à long terme. Conservez les secrets dans un gestionnaire d'identifiants sécurisé ou dans la configuration de l'environnement.",
    de:'Aus Sicherheitsgründen kann ich keine API-Schlüssel, Passwörter, Zugriffstoken oder andere Zugangsdaten im Langzeitgedächtnis speichern. Bewahren Sie Geheimnisse stattdessen in einem sicheren Anmeldedaten-Manager oder in der Umgebungskonfiguration auf.',
  },
  [RefusalCode.SENSITIVE_MEMORY_REJECTION]: {
    en:"I can't store this type of sensitive information in long-term memory. Only safe, durable project context and approved preferences can be remembered.",
    pt:'Não posso armazenar esse tipo de informação sensível na memória de longo prazo. Apenas contexto seguro e durável do projeto e preferências permitidas podem ser memorizados.',
    es:'No puedo almacenar este tipo de información sensible en la memoria a largo plazo. Solo se pueden recordar contexto seguro y duradero del proyecto y preferencias permitidas.',
    fr:'Je ne peux pas stocker ce type d’information sensible dans la mémoire à long terme. Seuls le contexte sûr et durable du projet et les préférences autorisées peuvent être mémorisés.',
    de:'Ich kann diese Art sensibler Informationen nicht im Langzeitgedächtnis speichern. Nur sicherer, dauerhafter Projektkontext und zulässige Präferenzen dürfen gespeichert werden.',
  },
  [RefusalCode.GENERIC_SAFETY_REJECTION]: {
    en:"This request can't be completed safely.", pt:'Esta solicitação não pode ser concluída com segurança.', es:'Esta solicitud no puede completarse de forma segura.', fr:'Cette demande ne peut pas être traitée en toute sécurité.', de:'Diese Anfrage kann nicht sicher bearbeitet werden.',
  },
};

const OUT_OF_SCOPE_MESSAGES: Record<ResponseLanguage, string> = {
  pt: 'Essa pergunta está fora do escopo do YVY HSE. Posso ajudar com informações relacionadas a HSE/QHSE e ao sistema, como KPIs, projetos, incidentes, ações, LOTO, PTW, avaliação de riscos e procedimentos de emergência.',
  en: 'This question is outside the scope of YVY HSE. I can assist with HSE/QHSE and system-related topics such as KPIs, projects, incidents, actions, LOTO, PTW, risk assessment and emergency procedures.',
  es: 'Esta pregunta está fuera del alcance de YVY HSE. Puedo ayudar con temas de HSE/QHSE y del sistema, como KPIs, proyectos, incidentes, acciones, LOTO, PTW, evaluación de riesgos y procedimientos de emergencia.',
  fr: 'Cette question est hors du périmètre de YVY HSE. Je peux aider sur les sujets HSE/QHSE et liés au système, notamment les KPI, projets, incidents, actions, LOTO, PTW, évaluations des risques et procédures d’urgence.',
  de: 'Diese Frage liegt außerhalb des Bereichs von YVY HSE. Ich kann bei HSE/QHSE- und systembezogenen Themen helfen, etwa KPIs, Projekten, Vorfällen, Maßnahmen, LOTO, PTW, Risikobewertungen und Notfallverfahren.',
};

export function controlledRefusalMessage(reason: string, input: string, uiLanguage?: string): string {
  const language = resolveResponseLanguage({ userMessage: input, uiLanguage });
  if (reason === RefusalCode.OUT_OF_SCOPE) return localized(OUT_OF_SCOPE_MESSAGES, language);
  return localized(COMMON_MESSAGES[reason] ?? COMMON_MESSAGES[RefusalCode.EMPTY_INPUT], language);
}

export async function refuseNode(state: HseAgentState, config: LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
  const runtime = config.configurable?.runtime as AgentRuntime | undefined;
  const reason = state.refusalReason ?? RefusalCode.EMPTY_INPUT;
  const input = [...state.messages].reverse().find((item) => item.role === 'user')?.content ?? '';
  const message = controlledRefusalMessage(reason, input, runtime?.responseLanguage);
  runtime?.emit({ type: 'text', text: message });
  return { status: AgentStatus.REFUSED, refusalReason: reason, finalText: message, executedRoute: [...state.executedRoute, 'refuse'] };
}
