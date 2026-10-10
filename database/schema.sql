-- Auto-generated schema for HSE Management System (PostgreSQL)
-- RAG additions are versioned separately in database/migrations and applied with `npm run migrate`.


CREATE TABLE IF NOT EXISTS projects (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  client          TEXT,
  location        TEXT,
  country_region  TEXT,
  project_manager TEXT,
  hse_manager     TEXT,
  project_type    TEXT,
  status          TEXT,
  start_date      DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS lookup_lists (
  id       SERIAL PRIMARY KEY,
  "group"  TEXT NOT NULL,
  title    TEXT NOT NULL,
  item     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  named_range  TEXT PRIMARY KEY,
  value        TEXT,
  used_for     TEXT
);

CREATE TABLE IF NOT EXISTS "manpower_log" (
  id SERIAL PRIMARY KEY,
  "date" DATE,
  "project_code" TEXT,
  "contractorcompany" TEXT,
  "tradediscipline" TEXT,
  "number_of_workers" NUMERIC,
  "hours_per_worker" NUMERIC,
  "total_manhours" NUMERIC,
  "month" TEXT,
  "cumulative_manhours_project" NUMERIC
);

CREATE TABLE IF NOT EXISTS "dashboard_data_engine" (
  id SERIAL PRIMARY KEY,
  "project_code" TEXT,
  "month" TEXT,
  "month_label" TEXT,
  "manhours" NUMERIC,
  "near_misses" TEXT,
  "recordable_incidents" TEXT,
  "lost_time_injuries" TEXT,
  "lost_days" NUMERIC,
  "open_actions" TEXT,
  "overdue_actions" TEXT,
  "training_compliance" NUMERIC,
  "audit_score_avg" NUMERIC,
  "observations_safe" TEXT,
  "observations_unsafe" TEXT,
  "permits_active" TEXT
);

CREATE TABLE IF NOT EXISTS "incident_register" (
  id SERIAL PRIMARY KEY,
  "incident_id" TEXT,
  "project_code" TEXT,
  "date_of_incident" DATE,
  "time" TEXT,
  "locationarea" TEXT,
  "incident_type" TEXT,
  "severity" TEXT,
  "description" TEXT,
  "injured_person_name" TEXT,
  "employeecontractor" TEXT,
  "departmenttrade" TEXT,
  "body_part_affected" TEXT,
  "immediate_cause" TEXT,
  "investigation_status" TEXT,
  "linked_investigation_id" TEXT,
  "linked_action_ids" TEXT,
  "lost_days" NUMERIC,
  "medical_treatment_required" TEXT,
  "reportable_to_authority" TEXT,
  "days_open" NUMERIC,
  "closed_date" DATE
);

CREATE TABLE IF NOT EXISTS "investigation_rca" (
  id SERIAL PRIMARY KEY,
  "investigation_id" TEXT,
  "linked_incident_id" TEXT,
  "project" TEXT,
  "investigation_team" TEXT,
  "investigation_date" DATE,
  "methodology" TEXT,
  "immediate_cause" TEXT,
  "root_cause_man" TEXT,
  "root_cause_machine" TEXT,
  "root_cause_method" TEXT,
  "root_cause_material" TEXT,
  "root_cause_environment" TEXT,
  "findings_summary" TEXT,
  "recommendations" TEXT,
  "responsible_person" TEXT,
  "target_completion" TEXT,
  "status" TEXT,
  "signoff_investigator" TEXT,
  "signoff_hse_manager" TEXT
);

CREATE TABLE IF NOT EXISTS "action_tracker_capa" (
  id SERIAL PRIMARY KEY,
  "action_id" TEXT,
  "source_module" TEXT,
  "source_reference" TEXT,
  "project" TEXT,
  "action_description" TEXT,
  "responsible_person" TEXT,
  "priority" TEXT,
  "target_date" DATE,
  "status" TEXT,
  "computed_status" TEXT,
  "days_remainingoverdue" NUMERIC,
  "closure_date" DATE,
  "verified_by" TEXT,
  "evidence_of_closure" TEXT,
  "comments" TEXT
);

CREATE TABLE IF NOT EXISTS "hira_register" (
  id SERIAL PRIMARY KEY,
  "hira_id" TEXT,
  "project" TEXT,
  "activitytask" TEXT,
  "location" TEXT,
  "date_assessed" DATE,
  "assessed_by" TEXT,
  "hazard_description" TEXT,
  "hazard_category" TEXT,
  "existing_controls" TEXT,
  "likelihood" TEXT,
  "consequence" TEXT,
  "risk_rating" TEXT,
  "risk_level" TEXT,
  "additional_controls_required" TEXT,
  "residual_likelihood" TEXT,
  "residual_consequence" TEXT,
  "residual_risk_rating" TEXT,
  "residual_risk_level" TEXT,
  "action_owner" TEXT,
  "review_date" DATE,
  "status" TEXT
);

CREATE TABLE IF NOT EXISTS "jsa_log" (
  id SERIAL PRIMARY KEY,
  "jsa_id" TEXT,
  "project" TEXT,
  "taskactivity" TEXT,
  "date" DATE,
  "prepared_by" TEXT,
  "approved_by" TEXT,
  "number_of_steps" NUMERIC,
  "permit_required" TEXT,
  "linked_permit_no" TEXT,
  "crew_briefed" TEXT,
  "briefing_date" DATE,
  "revision_number" TEXT,
  "valid_until" TEXT,
  "status" TEXT
);

CREATE TABLE IF NOT EXISTS "jsa_steps_detail" (
  id SERIAL PRIMARY KEY,
  "jsa_id" TEXT,
  "step_number" TEXT,
  "job_step_description" TEXT,
  "potential_hazards" TEXT,
  "control_measures" TEXT,
  "ppe_required_this_step" TEXT
);

CREATE TABLE IF NOT EXISTS "permit_to_work_register" (
  id SERIAL PRIMARY KEY,
  "permit_no" TEXT,
  "project" TEXT,
  "permit_type" TEXT,
  "work_description" TEXT,
  "location" TEXT,
  "requested_by" TEXT,
  "issued_by_authorized_person" TEXT,
  "linked_jsa_id" TEXT,
  "isolationloto_reference" TEXT,
  "gas_test_required" TEXT,
  "gas_test_reading" NUMERIC,
  "issue_datetime" DATE,
  "valid_from" TEXT,
  "valid_to" TEXT,
  "status" TEXT,
  "closed_by" TEXT,
  "closed_date" DATE,
  "remarks" TEXT
);

CREATE TABLE IF NOT EXISTS "safety_observations_bbs" (
  id SERIAL PRIMARY KEY,
  "observation_id" TEXT,
  "project" TEXT,
  "date" DATE,
  "observer_name" TEXT,
  "observed_personcrew" TEXT,
  "area" TEXT,
  "observation_type" TEXT,
  "category" TEXT,
  "description" TEXT,
  "immediate_action_taken" TEXT,
  "risk_level" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT,
  "status" TEXT,
  "closure_date" DATE
);

CREATE TABLE IF NOT EXISTS "toolbox_talks" (
  id SERIAL PRIMARY KEY,
  "tbt_id" TEXT,
  "project" TEXT,
  "date" DATE,
  "topic" TEXT,
  "conducted_by" TEXT,
  "duration_minutes" TEXT,
  "number_of_attendees" NUMERIC,
  "key_points_discussed" TEXT,
  "location" TEXT,
  "photoattendance_reference" TEXT,
  "questions_raised" TEXT,
  "next_topic_planned" TEXT
);

CREATE TABLE IF NOT EXISTS "training_competency" (
  id SERIAL PRIMARY KEY,
  "training_id" TEXT,
  "project" TEXT,
  "employee_name" TEXT,
  "employee_id" TEXT,
  "traderole" TEXT,
  "coursetraining_name" TEXT,
  "training_provider" TEXT,
  "date_completed" DATE,
  "certificate_no" TEXT,
  "validity_months" TEXT,
  "expiry_date" DATE,
  "status" TEXT,
  "trainer" TEXT,
  "scoreresult" NUMERIC
);

CREATE TABLE IF NOT EXISTS "ppe_register" (
  id SERIAL PRIMARY KEY,
  "issue_id" TEXT,
  "project" TEXT,
  "employee_name" TEXT,
  "ppe_item" TEXT,
  "size" TEXT,
  "quantity" NUMERIC,
  "issue_date" DATE,
  "expected_lifespan_months" TEXT,
  "replacement_due" TEXT,
  "status" TEXT,
  "condition_at_issue" TEXT,
  "acknowledged_signature" TEXT
);

CREATE TABLE IF NOT EXISTS "contractor_management" (
  id SERIAL PRIMARY KEY,
  "contractor_id" TEXT,
  "contractor_name" TEXT,
  "projects" TEXT,
  "hse_policy_on_file" TEXT,
  "prequalification_score" NUMERIC,
  "approved" TEXT,
  "approval_date" DATE,
  "reviewexpiry_date" DATE,
  "status" TEXT,
  "manhours_this_month" NUMERIC,
  "incidents_this_contractor" TEXT,
  "observations_this_contractor" TEXT,
  "overall_rating" TEXT
);

CREATE TABLE IF NOT EXISTS "site_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "area_inspected" TEXT,
  "housekeeping" TEXT,
  "walkwaysaccess_clear" TEXT,
  "signage_adequate" TEXT,
  "ppe_compliance_observed" TEXT,
  "barricadingexclusion_zones" TEXT,
  "waste_segregation" TEXT,
  "electrical_cablespanels_safe" TEXT,
  "lighting_adequate" TEXT,
  "emergency_exits_clear" TEXT,
  "fire_equipment_accessible" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "scaffold_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "scaffold_tag_nolocation" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "scaffold_type" TEXT,
  "base_platessole_boards_sound" TEXT,
  "standards_plumb" TEXT,
  "tiesbracing_adequate" TEXT,
  "platform_boards_fully_decked" TEXT,
  "guardrails_toe_boards_fitted" TEXT,
  "access_ladder_secure" TEXT,
  "load_rating_tag_displayed" TEXT,
  "overloading_signs" TEXT,
  "weathercorrosion_damage" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "lifting_equipment_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "equipment_id" TEXT,
  "equipment_type" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "thirdparty_certifying_body" TEXT,
  "structuralvisual_condition" TEXT,
  "load_chartswl_marking_legible" TEXT,
  "hookslatches_functional" TEXT,
  "wire_ropechain_condition" TEXT,
  "certification_current" TEXT,
  "load_test_current" TEXT,
  "operator_certification_current" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "fire_equipment_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "extinguisherequipment_id" TEXT,
  "location" TEXT,
  "type" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "pressure_gauge_in_green_zone" TEXT,
  "pinseal_intact" TEXT,
  "no_physical_damage" TEXT,
  "signagelocation_visible" TEXT,
  "access_not_obstructed" TEXT,
  "service_tag_current" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "vehicle_plant_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "vehicleplant_id" TEXT,
  "driveroperator" TEXT,
  "date" DATE,
  "odometerhourmeter_reading" NUMERIC,
  "tirestracks_condition" TEXT,
  "brakes_functional" TEXT,
  "lightsindicatorsreverse_alarm" TEXT,
  "mirrorsvisibility" TEXT,
  "seatbelt_functional" TEXT,
  "fire_extinguisher_on_board" TEXT,
  "leaks_oilfuelhydraulic" TEXT,
  "horn_functional" TEXT,
  "load_securing_equipment" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "ladder_inspection" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "ladder_idtag" TEXT,
  "type" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "rungssteps_intact" TEXT,
  "feetnonslip_base_present" TEXT,
  "locking_mechanism_functional" TEXT,
  "no_crackscorrosionbends" TEXT,
  "duty_rating_label_legible" TEXT,
  "stored_correctly" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "first_aid_emergency_equip" (
  id SERIAL PRIMARY KEY,
  "inspection_id" TEXT,
  "project" TEXT,
  "equipment_type" TEXT,
  "location" TEXT,
  "date" DATE,
  "inspector" TEXT,
  "contents_complete_vs_checklist" TEXT,
  "no_expired_items" TEXT,
  "boxcabinet_in_good_condition" TEXT,
  "location_signposted" TEXT,
  "access_clear" TEXT,
  "score" NUMERIC,
  "overall_result" TEXT,
  "action_required" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "equipment_plant_register" (
  id SERIAL PRIMARY KEY,
  "equipment_id" TEXT,
  "project" TEXT,
  "equipment_type" TEXT,
  "makemodel" TEXT,
  "serial_no" TEXT,
  "ownership" TEXT,
  "last_calibrationcertification" TEXT,
  "certifying_body" TEXT,
  "certificate_expiry" TEXT,
  "status" TEXT,
  "next_maintenance_due" TEXT,
  "operator_assigned" TEXT,
  "inservice_status" TEXT
);

CREATE TABLE IF NOT EXISTS "waste_management_log" (
  id SERIAL PRIMARY KEY,
  "waste_id" TEXT,
  "project" TEXT,
  "date" DATE,
  "waste_type" TEXT,
  "description" TEXT,
  "quantity" NUMERIC,
  "unit" TEXT,
  "disposal_method" TEXT,
  "disposal_company" TEXT,
  "manifestwaste_transfer_note_no" TEXT,
  "disposal_date" DATE,
  "certificate_reference" TEXT
);

CREATE TABLE IF NOT EXISTS "chemical_inventory_msds" (
  id SERIAL PRIMARY KEY,
  "chemical_id" TEXT,
  "chemical_name" TEXT,
  "project" TEXT,
  "location_stored" TEXT,
  "quantity_on_site" NUMERIC,
  "unit" TEXT,
  "ghs_hazard_class" TEXT,
  "msds_on_file" TEXT,
  "msds_last_updated" TEXT,
  "msds_review_due" TEXT,
  "storage_conditions" TEXT,
  "handling_precautions" TEXT,
  "status" TEXT
);

CREATE TABLE IF NOT EXISTS "spill_environmental_incident" (
  id SERIAL PRIMARY KEY,
  "spill_id" TEXT,
  "project" TEXT,
  "datetime" DATE,
  "substance" TEXT,
  "quantity_spilled" NUMERIC,
  "unit" TEXT,
  "location" TEXT,
  "cause" TEXT,
  "immediate_response_taken" TEXT,
  "reported_to_authority" TEXT,
  "linked_action_id" TEXT,
  "status" TEXT
);

CREATE TABLE IF NOT EXISTS "environmental_monitoring" (
  id SERIAL PRIMARY KEY,
  "monitoring_id" TEXT,
  "project" TEXT,
  "parameter" TEXT,
  "date" DATE,
  "location" TEXT,
  "measured_value" TEXT,
  "permissible_limit" TEXT,
  "result" TEXT,
  "corrective_action_if_exceedance" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_tracker" (
  id SERIAL PRIMARY KEY,
  "audit_id" TEXT,
  "project" TEXT,
  "audit_type" TEXT,
  "audit_date" DATE,
  "auditors" TEXT,
  "scope" TEXT,
  "standardreference" TEXT,
  "number_of_findings" NUMERIC,
  "overall_audit_score" NUMERIC,
  "next_audit_due" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_tracker__audit_findings_detail_register" (
  id SERIAL PRIMARY KEY,
  "finding_id" TEXT,
  "audit_id" TEXT,
  "clause_reference" TEXT,
  "finding_description" TEXT,
  "classification" TEXT,
  "responsible_person" TEXT,
  "target_close_date" DATE,
  "status" TEXT,
  "evidencelink" TEXT,
  "linked_action_id" TEXT
);

CREATE TABLE IF NOT EXISTS "legal_compliance_register" (
  id SERIAL PRIMARY KEY,
  "requirement_id" TEXT,
  "applicability" TEXT,
  "regulationstandard_name" TEXT,
  "authorityjurisdiction" TEXT,
  "requirement_description" TEXT,
  "applicable_clause" TEXT,
  "compliance_status" TEXT,
  "evidence_of_compliance" TEXT,
  "responsible_person" TEXT,
  "review_frequency_months" TEXT,
  "last_review_date" DATE,
  "next_review_date" DATE,
  "comments" TEXT
);

CREATE TABLE IF NOT EXISTS "management_of_change" (
  id SERIAL PRIMARY KEY,
  "moc_id" TEXT,
  "project" TEXT,
  "change_description" TEXT,
  "change_type" TEXT,
  "initiated_by" TEXT,
  "date_initiated" DATE,
  "risk_assessment_required" TEXT,
  "linked_hira_id" TEXT,
  "approval_level_required" TEXT,
  "approved_by" TEXT,
  "approval_date" DATE,
  "implementation_date" DATE,
  "status" TEXT,
  "review_date" DATE,
  "days_since_initiated" NUMERIC,
  "risk_assessment_flag" TEXT,
  "comments" TEXT
);

CREATE TABLE IF NOT EXISTS "document_control" (
  id SERIAL PRIMARY KEY,
  "document_id" TEXT,
  "document_name" TEXT,
  "category" TEXT,
  "applicability" TEXT,
  "version_no" TEXT,
  "prepared_by" TEXT,
  "reviewed_by" TEXT,
  "approved_by" TEXT,
  "issue_date" DATE,
  "review_frequency_months" TEXT,
  "next_review_due" TEXT,
  "status" TEXT,
  "file_locationlink" TEXT
);

CREATE TABLE IF NOT EXISTS "meeting_minutes" (
  id SERIAL PRIMARY KEY,
  "meeting_id" TEXT,
  "project" TEXT,
  "meeting_type" TEXT,
  "date" DATE,
  "attendees" TEXT,
  "agenda_items" TEXT,
  "key_discussion_points" TEXT,
  "actions_raised" TEXT,
  "next_meeting_date" DATE
);

CREATE TABLE IF NOT EXISTS "kpi_statistics_engine" (
  id SERIAL PRIMARY KEY,
  "project_code" TEXT,
  "month" TEXT,
  "manhours" NUMERIC,
  "recordable_incidents" TEXT,
  "lost_time_injuries" TEXT,
  "lost_days" NUMERIC,
  "near_misses" TEXT,
  "trir" TEXT,
  "ltifr" TEXT,
  "severity_rate" NUMERIC,
  "near_miss_ratio" TEXT,
  "training_compliance" NUMERIC,
  "audit_score_avg" NUMERIC,
  "observations_safe" TEXT,
  "observations_unsafe" TEXT
);

CREATE TABLE IF NOT EXISTS "annual_hse_calendar" (
  id SERIAL PRIMARY KEY,
  "activity" TEXT,
  "project" TEXT,
  "planned_month" TEXT,
  "planned_date" DATE,
  "responsible_person" TEXT,
  "status" TEXT,
  "actual_date" DATE,
  "remarks" TEXT
);

CREATE TABLE IF NOT EXISTS "annual_hse_calendar__12month_project_activity_matrix" (
  id SERIAL PRIMARY KEY,
  "project" TEXT,
  "january" TEXT,
  "february" TEXT,
  "march" TEXT,
  "april" TEXT,
  "may" TEXT,
  "june" TEXT,
  "july" TEXT,
  "august" TEXT,
  "september" TEXT,
  "october" TEXT,
  "november" TEXT,
  "december" TEXT
);

CREATE TABLE IF NOT EXISTS "change_log" (
  id SERIAL PRIMARY KEY,
  "version_no" TEXT,
  "date" DATE,
  "changed_by" TEXT,
  "description_of_change" TEXT,
  "sheets_affected" TEXT
);

CREATE TABLE IF NOT EXISTS "emergency_preparedness" (
  id SERIAL PRIMARY KEY,
  "name" TEXT,
  "role" TEXT,
  "project" TEXT,
  "phone_primary" TEXT,
  "phone_alternate" TEXT,
  "available_247" TEXT
);

CREATE TABLE IF NOT EXISTS "emergency_preparedness__emergency_response_plan_summary" (
  id SERIAL PRIMARY KEY,
  "scenario" TEXT,
  "immediate_actions" TEXT,
  "assemblymuster_point" TEXT,
  "responsible_team" TEXT,
  "reference_document" TEXT
);

CREATE TABLE IF NOT EXISTS "emergency_preparedness__emergency_drill_register" (
  id SERIAL PRIMARY KEY,
  "drill_id" TEXT,
  "project" TEXT,
  "drill_type" TEXT,
  "date" DATE,
  "participants_count" TEXT,
  "evacuationresponse_time_minutes" TEXT,
  "observations" TEXT,
  "improvement_actions" TEXT,
  "next_drill_due" TEXT
);
