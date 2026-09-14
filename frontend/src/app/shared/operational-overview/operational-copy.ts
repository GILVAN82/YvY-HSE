import type { Lang } from '../../core/i18n.service';

const copy = {
  overview: ['Operational overview','Resumo operacional','Resumen operativo','Vue opérationnelle','Betriebsübersicht'],
  generic: ['Operational data','Dados operacionais','Datos operativos','Données opérationnelles','Betriebsdaten'],
  actions: ['Actions','Ações','Acciones','Actions','Maßnahmen'],
  incidents: ['Incidents','Incidentes','Incidentes','Incidents','Vorfälle'],
  projects: ['Projects','Projetos','Proyectos','Projets','Projekte'],
  kpi: ['Safety performance','Desempenho de segurança','Desempeño de seguridad','Performance sécurité','Sicherheitsleistung'],
  pending: ['pending','pendentes','pendientes','en attente','offen'],
  open: ['open','em aberto','abiertos','ouverts','offen'],
  matching: ['matching records','registros encontrados','registros encontrados','enregistrements correspondants','passende Einträge'],
  available: ['Data available','Dados disponíveis','Datos disponibles','Données disponibles','Daten verfügbar'],
  retrieved: ['Data retrieved for the current query scope.','Dados consultados no escopo atual da consulta.','Datos consultados en el alcance actual de la consulta.','Données récupérées pour le périmètre actuel de la requête.','Daten für den aktuellen Abfragebereich abgerufen.'],
  noPending: ['No pending actions found.','Nenhuma ação pendente encontrada.','No se encontraron acciones pendientes.','Aucune action en attente trouvée.','Keine offenen Maßnahmen gefunden.'],
  noOpen: ['No open incidents found.','Nenhum incidente em aberto encontrado.','No se encontraron incidentes abiertos.','Aucun incident ouvert trouvé.','Keine offenen Vorfälle gefunden.'],
  noRecords: ['No matching records','Nenhum registro correspondente','No hay registros coincidentes','Aucun enregistrement correspondant','Keine passenden Einträge'],
  noKpi: ['No matching performance indicators','Nenhum indicador de desempenho correspondente','No hay indicadores de desempeño coincidentes','Aucun indicateur de performance correspondant','Keine passenden Leistungskennzahlen'],
  unavailable: ['Data unavailable','Dados indisponíveis','Datos no disponibles','Données indisponibles','Daten nicht verfügbar'],
  retry: ['This information is temporarily unavailable. Try again.','Esta informação está temporariamente indisponível. Tente novamente.','Esta información no está disponible temporalmente. Inténtelo de nuevo.','Cette information est temporairement indisponible. Réessayez.','Diese Information ist vorübergehend nicht verfügbar. Bitte erneut versuchen.'],
  verified: ['Verified','Verificado','Verificado','Vérifié','Verifiziert'],
  partial: ['Partially verified','Parcialmente verificado','Parcialmente verificado','Partiellement vérifié','Teilweise verifiziert'],
  confirmation: ['Needs confirmation','Precisa de confirmação','Requiere confirmación','À confirmer','Bestätigung erforderlich'],
  evidenceUnavailable: ['Evidence unavailable','Evidências indisponíveis','Evidencias no disponibles','Preuves indisponibles','Nachweise nicht verfügbar'],
  supporting: ['Supporting evidence','Evidências de suporte','Evidencias de respaldo','Preuves à l’appui','Unterstützende Nachweise'],
  viewEvidence: ['View evidence','Ver evidências','Ver evidencias','Voir les preuves','Nachweise anzeigen'],
  hideEvidence: ['Hide evidence','Ocultar evidências','Ocultar evidencias','Masquer les preuves','Nachweise ausblenden'],
  source: ['Source','Fonte','Fuente','Source','Quelle'],
  view: ['View','Ver','Ver','Voir','Anzeigen'],
  details: ['View details','Ver detalhes','Ver detalles','Voir les détails','Details anzeigen'],
  days: ['Days since LTI','Dias desde LTI','Días desde LTI','Jours depuis LTI','Tage seit LTI'],
  atLeast: ['At least','Pelo menos','Al menos','Au moins','Mindestens'],
} satisfies Record<string, [string,string,string,string,string]>;
export type OperationalCopyKey = keyof typeof copy;
export function operationalLanguage(value: string | undefined): Lang {
  return ['en','pt','es','fr','de'].includes(value ?? '') ? value as Lang : 'en';
}
export function operationalCopy(key: OperationalCopyKey, language: string = 'en'): string {
  return copy[key][['en','pt','es','fr','de'].indexOf(operationalLanguage(language))];
}
