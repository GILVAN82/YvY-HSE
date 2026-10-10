/** Recheck current membership against the live source, even for historical alerts.
 * Missing/deleted sources and legacy approvals without scope are not disclosed.
 */
export function alertAccessSql(alias='yvy_proactive_alert'):string {
  return `EXISTS(SELECT 1 FROM app_user au WHERE au.id=${alias}.user_id AND au.active=true AND (
    (${alias}.source_type='OPERATIONAL_DATA' AND EXISTS(SELECT 1 FROM action_tracker_capa src WHERE src.action_id=${alias}.source_id AND
      (au.role='ADMIN' OR (EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=src.project) AND NOT EXISTS(SELECT 1 FROM action_tracker_capa other WHERE other.action_id=src.action_id AND NOT EXISTS(SELECT 1 FROM app_user_project allowed WHERE allowed.user_id=au.id AND allowed.project_code=other.project))))))
    OR (${alias}.source_type='HITL' AND EXISTS(SELECT 1 FROM agent_human_approval ha JOIN agent_thread_state ts ON ts.thread_id=ha.thread_id
      WHERE ha.id::text=${alias}.source_id AND ts.user_id=au.id AND ha.requested_by=au.id AND ha.scope_projects IS NOT NULL AND cardinality(ha.scope_projects)>0
      AND NOT EXISTS(SELECT 1 FROM unnest(ha.scope_projects) sp(project) WHERE NOT EXISTS(SELECT 1 FROM projects pr WHERE pr.code=sp.project)
        OR (au.role<>'ADMIN' AND NOT EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=sp.project)))))
  ))`;
}
