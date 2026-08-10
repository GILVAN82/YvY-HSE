'use strict';

const projects = [
  ['DEMO-LIS-01', 'DC Lisbon 01', 'Synthetic Client Alpha', 'Lisbon', 'Portugal', 'Project Manager', 'HSE Coordinator', 'Data Center', 'Active', '2026-01-05', '2027-06-30', null, 'Synthetic demonstration project'],
  ['DEMO-MAD-02', 'DC Madrid 02', 'Synthetic Client Beta', 'Madrid', 'Spain', 'Project Manager', 'HSE Coordinator', 'Data Center', 'Active', '2026-02-02', '2027-09-30', null, 'Synthetic demonstration project'],
  ['DEMO-DUB-03', 'DC Dublin 03', 'Synthetic Client Gamma', 'Dublin', 'Ireland', 'Project Manager', 'HSE Coordinator', 'Data Center', 'Planning', '2026-09-01', '2028-03-31', null, 'Synthetic demonstration project'],
];

const manpower = [
  ['2026-06-30', 'DEMO-LIS-01', 'Synthetic Electrical Contractor', 'Electrical', 50, 2000, 100000, 'June', 100000],
  ['2026-06-30', 'DEMO-MAD-02', 'Synthetic Civil Contractor', 'Civil', 40, 2000, 80000, 'June', 80000],
  ['2026-06-30', 'DEMO-DUB-03', 'Synthetic Planning Team', 'Planning', 60, 2000, 120000, 'June', 120000],
];

const incidents = [
  ['DEMO-INC-001', 'DEMO-LIS-01', '2026-03-12', '10:30', 'Electrical room', 'Near Miss', 'Low', 'Isolation label mismatch identified before work started', null, 'Contractor', 'Electrical', null, 'Verification gap', 'Closed', null, 'DEMO-ACT-001', 0, 'No', 'No', 2, '2026-03-14'],
  ['DEMO-INC-002', 'DEMO-MAD-02', '2026-04-08', '14:10', 'Access route', 'First Aid', 'Minor', 'Worker slipped on temporary floor protection without lasting injury', null, 'Contractor', 'Civil', null, 'Housekeeping', 'Closed', null, 'DEMO-ACT-003', 0, 'Yes', 'No', 1, '2026-04-09'],
  ['DEMO-INC-003', 'DEMO-LIS-01', '2026-05-20', '09:00', 'Loading area', 'Property Damage', 'Moderate', 'Material trolley contacted a temporary barrier', null, 'Contractor', 'Logistics', null, 'Route control', 'Closed', null, 'DEMO-ACT-005', 0, 'No', 'No', 3, '2026-05-23'],
  ['DEMO-INC-004', 'DEMO-MAD-02', '2026-06-15', '11:20', 'Storage area', 'Medical Treatment Injury', 'Moderate', 'Minor manual-handling strain during synthetic lifting scenario', null, 'Contractor', 'Mechanical', null, 'Manual handling plan', 'Closed', null, 'DEMO-ACT-007', 0, 'Yes', 'No', 4, '2026-06-19'],
  ['DEMO-INC-005', 'DEMO-DUB-03', '2026-07-05', '15:40', 'Planning office', 'Lost Time Injury', 'Moderate', 'Synthetic ergonomic event used only for KPI demonstration', null, 'Employee', 'Planning', null, 'Workstation setup', 'Closed', null, 'DEMO-ACT-009', 1, 'Yes', 'No', 5, '2026-07-10'],
];

const actions = [
  ['DEMO-ACT-001','Incident','DEMO-INC-001','DEMO-LIS-01','Review LOTO isolation verification','Electrical Supervisor','High','2026-01-10','Open','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-002','HIRA','DEMO-HIRA-001','DEMO-LIS-01','Install controlled access signage','Site Manager','Medium','2026-02-05','In Progress','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-003','Incident','DEMO-INC-002','DEMO-MAD-02','Improve temporary floor protection','HSE Coordinator','High','2026-02-20','Open','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-004','Audit','DEMO-AUD-001','DEMO-LIS-01','Close electrical audit documentation gap','Electrical Supervisor','High','2026-03-01','In Progress','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-005','Incident','DEMO-INC-003','DEMO-LIS-01','Separate trolley and pedestrian routes','Logistics Supervisor','Medium','2026-03-18','Open','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-006','PTW','DEMO-PTW-002','DEMO-MAD-02','Refresh hot-work fire watch briefing','HSE Coordinator','High','2026-04-02','Open','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-007','Incident','DEMO-INC-004','DEMO-MAD-02','Repeat manual-handling assessment','Site Manager','Medium','2026-04-20','In Progress','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-008','Contractor','DEMO-CON-002','DEMO-MAD-02','Verify contractor induction evidence','HSE Coordinator','Low','2026-05-15','Open','Overdue',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-009','Incident','DEMO-INC-005','DEMO-DUB-03','Complete workstation ergonomic review','Project Manager','Medium','2099-12-15','Open','Open',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-010','HIRA','DEMO-HIRA-004','DEMO-DUB-03','Confirm design-stage lifting controls','Design Manager','Medium','2099-12-31','Open','Open',null,null,null,null,'Synthetic'],
  ['DEMO-ACT-011','Audit','DEMO-AUD-002','DEMO-MAD-02','Archive completed audit evidence','HSE Coordinator','Low','2026-06-01','Closed','Closed',null,'2026-05-28','HSE Coordinator','Synthetic evidence','Synthetic'],
  ['DEMO-ACT-012','PTW','DEMO-PTW-003','DEMO-LIS-01','Close work-at-height permit package','Site Manager','Low','2026-06-10','Closed','Closed',null,'2026-06-09','Site Manager','Synthetic evidence','Synthetic'],
];

const jsa = [
  ['DEMO-JSA-001','DEMO-LIS-01','Electrical isolation verification','2026-07-01','Electrical Supervisor','Site Manager',4,'Yes','DEMO-PTW-001','Yes','2026-07-01','1','2026-12-31','Approved'],
  ['DEMO-JSA-002','DEMO-MAD-02','Controlled hot work','2026-07-02','HSE Coordinator','Site Manager',5,'Yes','DEMO-PTW-002','Yes','2026-07-02','1','2026-12-31','Approved'],
  ['DEMO-JSA-003','DEMO-LIS-01','Work at height inspection','2026-07-03','Site Manager','HSE Coordinator',4,'Yes','DEMO-PTW-003','Yes','2026-07-03','1','2026-12-31','Approved'],
  ['DEMO-JSA-004','DEMO-MAD-02','Confined-space readiness check','2026-07-04','HSE Coordinator','Site Manager',6,'Yes','DEMO-PTW-004','Yes','2026-07-04','1','2026-12-31','Draft'],
];

const permits = [
  ['DEMO-PTW-001','DEMO-LIS-01','Electrical Work','Verify isolation before panel inspection','Electrical room','Electrical Supervisor','Authorized Person','DEMO-JSA-001','DEMO-LOTO-001','No',null,'2026-07-10','2026-07-10 08:00','2026-07-10 18:00','Active',null,null,'Synthetic demonstration permit'],
  ['DEMO-PTW-002','DEMO-MAD-02','Hot Work','Controlled bracket welding','Plant room','Mechanical Supervisor','Authorized Person','DEMO-JSA-002',null,'Yes',20.9,'2026-07-11','2026-07-11 08:00','2026-07-11 16:00','Open',null,null,'Synthetic demonstration permit'],
  ['DEMO-PTW-003','DEMO-LIS-01','Work at Height','Inspect overhead containment','Data hall','Site Manager','Authorized Person','DEMO-JSA-003',null,'No',null,'2026-06-09','2026-06-09 08:00','2026-06-09 17:00','Closed','Authorized Person','2026-06-09','Synthetic demonstration permit'],
  ['DEMO-PTW-004','DEMO-MAD-02','Confined Space','Readiness assessment only','Service void','HSE Coordinator','Authorized Person','DEMO-JSA-004',null,'Yes',20.8,'2026-05-01','2026-05-01 08:00','2026-05-01 12:00','Expired',null,null,'Synthetic demonstration permit'],
];

const hira = [
  ['DEMO-HIRA-001','DEMO-LIS-01','Electrical isolation','Electrical room','2026-01-05','HSE Coordinator','Unexpected energization','Electrical','LOTO and verification','3','5','15','High','Independent verification','1','5','5','Medium','Electrical Supervisor','2026-10-01','Active'],
  ['DEMO-HIRA-002','DEMO-MAD-02','Hot work','Plant room','2026-02-10','HSE Coordinator','Fire and hot surfaces','Fire','PTW and fire watch','3','4','12','High','Thermal screening','1','4','4','Low','Site Manager','2026-11-01','Active'],
  ['DEMO-HIRA-003','DEMO-LIS-01','Material movement','Loading area','2026-03-15','Site Manager','Vehicle and pedestrian interface','Traffic','Segregated routes','2','4','8','Medium','Additional barriers','1','4','4','Low','Logistics Supervisor','2026-12-01','Active'],
  ['DEMO-HIRA-004','DEMO-DUB-03','Design-stage lifting','Design office','2026-07-01','Design Manager','Unplanned lifting constraints','Lifting','Design review','2','3','6','Medium','Lift-plan hold point','1','3','3','Low','Design Manager','2027-01-15','Draft'],
];

module.exports = { actions, hira, incidents, jsa, manpower, permits, projects };
