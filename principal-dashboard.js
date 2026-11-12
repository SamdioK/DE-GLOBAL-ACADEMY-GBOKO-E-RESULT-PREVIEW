/* Principal's read-only oversight dashboard.
 * All displayed records are queried from Supabase using the signed-in Principal's
 * school_id. This module intentionally contains no write operations.
 */
(function () {
  'use strict';
  var sections = {
    principalDashboard: ['Principal Overview', 'A live executive summary of the school.'],
    principalStudents: ['Student Directory', 'Official student records and enrolment information.'],
    principalStaff: ['Staff & Teachers', 'Staff directory, designations and employment information.'],
    principalResults: ['Results Monitoring', 'Submission and publication progress from the official results register.'],
    principalReports: ['Academic Reports', 'Class and subject performance summaries based on saved results.'],
    principalRequests: ['Requests & Activity', 'Student correction requests and recorded school activity.'],
    principalProfile: ['School Profile', 'The school identity and current academic calendar.']
  };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }
  function date(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d.getTime()) ? esc(v) : d.toLocaleString();
  }
  function rootFor(tab) { return document.getElementById(tab + 'Tab'); }
  function frame(tab, body) {
    var meta = sections[tab] || ['Principal Dashboard', ''];
    return '<section class="principal-shell">' +
      '<div class="principal-hero"><div><div class="principal-eyebrow">DE-GLOBAL ACADEMY · EXECUTIVE PORTAL</div>' +
      '<h2>' + esc(meta[0]) + '</h2><p>' + esc(meta[1]) + '</p></div>' +
      '<div class="principal-avatar">P</div></div>' +
      '<div class="principal-context"><span>Signed in as <strong>' + esc(currentUser && currentUser.name || 'Principal') +
      '</strong></span><span>' + esc(schoolInfo && schoolInfo.name || currentSchool && currentSchool.schoolName || 'School') +
      '</span><span class="principal-live"><i></i> Live Supabase records</span></div>' + body + '</section>';
  }
  function styleOnce() {
    if (document.getElementById('principalDashboardStyles')) return;
    var style = document.createElement('style');
    style.id = 'principalDashboardStyles';
    style.textContent = `
      .principal-shell{color:#18312d}
      .principal-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:25px 28px;border-radius:18px;background:linear-gradient(120deg,#103d35,#176b59 62%,#d3a84e);color:#fff;box-shadow:0 12px 28px rgba(16,61,53,.16)}
      .principal-hero h2{font-size:clamp(22px,3vw,30px);margin:5px 0}.principal-hero p{margin:0;color:#e2eee9;font-size:13px}
      .principal-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:800;color:#e8c875}
      .principal-avatar{width:58px;height:58px;flex:0 0 58px;border-radius:18px;display:grid;place-items:center;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);font-size:26px;font-weight:800}
      .principal-context{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:13px 3px;color:#60716d;font-size:12px}
      .principal-live{margin-left:auto;color:#176b59;font-weight:700}.principal-live i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#1aaf79;margin-right:6px}
      .principal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:13px;margin:15px 0}
      .principal-stat{background:#fff;border:1px solid #e4ece8;border-radius:13px;padding:17px;box-shadow:0 4px 14px rgba(20,55,46,.045)}
      .principal-stat .label{font-size:12px;color:#71817c}.principal-stat strong{display:block;font-size:27px;color:#123f35;margin:7px 0}.principal-stat small{font-size:11px;color:#899690}
      .principal-panel{background:#fff;border:1px solid #e4ece8;border-radius:13px;padding:18px;margin:14px 0;box-shadow:0 4px 14px rgba(20,55,46,.04)}
      .principal-panel h3{font-size:16px;color:#164a3d;margin-bottom:12px}.principal-actions{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0}
      .principal-actions button{border:1px solid #d5e3dd;background:#f5faf7;color:#175b49;border-radius:9px;padding:10px 13px;font-weight:700;cursor:pointer}
      .principal-actions button:hover{background:#e8f4ed;border-color:#9fc9b5}
      .principal-table-wrap{overflow-x:auto}.principal-table{width:100%;border-collapse:collapse;min-width:560px;font-size:12px}
      .principal-table th{background:#f2f7f4;color:#52665e;text-align:left}.principal-table td,.principal-table th{padding:10px;border-bottom:1px solid #edf1ee}
      .principal-pill{display:inline-block;border-radius:20px;padding:4px 9px;background:#edf5ef;color:#21644e;font-size:10px;font-weight:700;text-transform:capitalize}
      .principal-muted{color:#778780;font-size:12px}.principal-error{padding:12px;border-radius:9px;background:#fff2f0;color:#9b3328}
      .principal-bar{height:8px;background:#edf2ee;border-radius:10px;overflow:hidden}.principal-bar span{display:block;height:100%;background:linear-gradient(90deg,#176b59,#d1a34b)}
      .principal-section-title{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      @media(max-width:600px){.principal-hero{padding:19px}.principal-avatar{width:46px;height:46px;flex-basis:46px}.principal-live{margin-left:0}.principal-context{gap:8px}}
    `;
    document.head.appendChild(style);
  }
  async function query(table, columns, options) {
    var q = supabaseClient.from(table).select(columns || '*');
    if (options && options.count) q = supabaseClient.from(table).select('id', {count:'exact',head:true});
    q = q.eq('school_id', authenticatedProfile.school_id);
    if (options && options.order) q = q.order(options.order, {ascending:false});
    if (options && options.limit) q = q.limit(options.limit);
    if (options && options.eq) Object.keys(options.eq).forEach(function(k){ q = q.eq(k, options.eq[k]); });
    var r = await q;
    if (r.error) throw r.error;
    return options && options.count ? (r.count || 0) : (r.data || []);
  }
  async function count(table, extra) {
    return await query(table, 'id', {count:true, eq:extra || {}});
  }
  async function queryAll(table, columns, orderColumn) {
    var all = [], offset = 0, pageSize = 1000;
    while (true) {
      var result = await supabaseClient.from(table).select(columns || '*')
        .eq('school_id', authenticatedProfile.school_id)
        .order(orderColumn || 'created_at', {ascending:false})
        .range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      var batch = result.data || [];
      all = all.concat(batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  }
  function stat(label, value, note) {
    return '<div class="principal-stat"><span class="label">' + esc(label) + '</span><strong>' +
      esc(value) + '</strong><small>' + esc(note || 'Official school record') + '</small></div>';
  }
  function table(headers, rows, empty) {
    if (!rows.length) return '<p class="principal-muted">' + esc(empty || 'No records found.') + '</p>';
    return '<div class="principal-table-wrap"><table class="principal-table"><thead><tr>' +
      headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('') + '</tr></thead><tbody>' +
      rows.join('') + '</tbody></table></div>';
  }
  function row(values) { return '<tr>' + values.map(function(v){return '<td>'+v+'</td>';}).join('') + '</tr>'; }
  async function renderOverview(root) {
    root.innerHTML = frame('principalDashboard','<div class="principal-panel">Loading live school indicators…</div>');
    try {
      var vals = await Promise.all([
        count('students'), count('classes'), count('school_staff_directory'),
        count('subjects'), queryAll('results','id,status,total,grade,academic_session_id,term_id','created_at'),
        query('academic_sessions','id,name,is_current',{order:'created_at',limit:20}),
        query('terms','id,name,term_number,is_current',{limit:10})
      ]);
      var students=vals[0], classes=vals[1], staff=vals[2], subjects=vals[3], results=vals[4], sessions=vals[5], terms=vals[6];
      var currentSession=sessions.find(function(x){return x.is_current;}) || sessions[0];
      var currentTerm=terms.find(function(x){return x.is_current;}) || terms.sort(function(a,b){return Number(a.term_number)-Number(b.term_number);})[0];
      var activeResults=results.filter(function(r){return (!currentSession || r.academic_session_id===currentSession.id) && (!currentTerm || r.term_id===currentTerm.id);});
      var submitted=activeResults.filter(function(r){return ['submitted','approved','published'].indexOf(String(r.status||'').toLowerCase())!==-1;}).length;
      var published=activeResults.filter(function(r){return String(r.status||'').toLowerCase()==='published';}).length;
      var avg=activeResults.length?Math.round(activeResults.reduce(function(s,r){return s+Number(r.total||0);},0)/activeResults.length):0;
      var pct=activeResults.length?Math.round(submitted/activeResults.length*100):0;
      root.innerHTML=frame('principalDashboard',
        '<div class="principal-grid">'+stat('Enrolled Students',students,'Official student register')+
        stat('Class Arms',classes,'Configured classes')+stat('Staff Records',staff,'Staff directory')+
        stat('Active Subjects',subjects,'School subject catalogue')+stat('Result Entries',activeResults.length,'Current session')+
        stat('Published Entries',published,'Current session')+'</div>'+
        '<div class="principal-panel"><div class="principal-section-title"><h3>Academic Snapshot</h3><span class="principal-pill">'+esc(currentSession&&currentSession.name||'Session not set')+'</span></div>'+
        '<p class="principal-muted">Current term: '+esc(currentTerm&&currentTerm.name||'Not configured')+'</p>'+
        '<p style="margin:14px 0 6px;font-size:12px">Result workflow completion · '+pct+'%</p><div class="principal-bar"><span style="width:'+pct+'%"></span></div>'+
        '<div class="principal-grid" style="margin-top:15px">'+stat('Submitted / Approved',submitted,'Entries beyond draft')+stat('Average Recorded Score',avg+'%','Based on current-session result entries')+'</div></div>'+
        '<div class="principal-panel"><h3>Quick access</h3><div class="principal-actions">'+
        '<button data-principal-go="principalStudents">Review students</button><button data-principal-go="principalStaff">View staff</button>'+
        '<button data-principal-go="principalResults">Monitor results</button><button data-principal-go="principalReports">Academic reports</button>'+
        '<button data-principal-go="principalRequests">Requests & activity</button></div></div>'+
        '<p class="principal-muted">Figures are read from Supabase when this page loads. They are not editable from the Principal account.</p>');
    } catch(e) { root.innerHTML=frame('principalDashboard','<div class="principal-error">Dashboard data could not be loaded: '+esc(e.message||e)+'</div>'); }
  }
  async function renderStudents(root) {
    root.innerHTML=frame('principalStudents','<div class="principal-panel">Loading official student register…</div>');
    try {
      var rows=await query('students','id,admission_number,first_name,middle_name,last_name,gender',{order:'created_at',limit:500});
      root.innerHTML=frame('principalStudents','<div class="principal-panel"><div class="principal-section-title"><h3>Official Student Register</h3><span class="principal-pill">'+rows.length+' shown</span></div>'+
        table(['Admission No.','Student Name','Gender'],rows.map(function(s){return row([esc(s.admission_number),esc([s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ')),esc(s.gender||'—')]);}),'No student records are available.')+
        '<p class="principal-muted">Read-only view of records from the existing Student Register. Maximum 500 records are shown in this view.</p></div>');
    } catch(e){root.innerHTML=frame('principalStudents','<div class="principal-error">Student records could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  async function renderStaff(root) {
    root.innerHTML=frame('principalStaff','<div class="principal-panel">Loading staff directory…</div>');
    try {
      var rows=await query('school_staff_directory','id,staff_id,full_name,designation,department,employment_type,status',{order:'created_at',limit:500});
      root.innerHTML=frame('principalStaff','<div class="principal-panel"><div class="principal-section-title"><h3>Staff & Teachers</h3><span class="principal-pill">'+rows.length+' shown</span></div>'+
        table(['Staff ID','Name','Designation','Department','Employment','Status'],rows.map(function(s){return row([esc(s.staff_id||'—'),esc(s.full_name),esc(s.designation||'—'),esc(s.department||'—'),esc(s.employment_type||'—'),'<span class="principal-pill">'+esc(s.status||'—')+'</span>']);}),'No staff directory records are available.')+'</div>');
    } catch(e){root.innerHTML=frame('principalStaff','<div class="principal-error">Staff records could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  async function renderResults(root) {
    root.innerHTML=frame('principalResults','<div class="principal-panel">Loading results workflow…</div>');
    try {
      var rows=await queryAll('results','id,status,total,grade,academic_session_id,term_id,student_id,class_id,subject_id,submitted_at,approved_at,published_at','created_at');
      var tally={draft:0,submitted:0,approved:0,published:0,other:0};
      rows.forEach(function(r){var s=String(r.status||'other').toLowerCase();if(tally.hasOwnProperty(s))tally[s]++;else tally.other++;});
      root.innerHTML=frame('principalResults','<div class="principal-grid">'+stat('Draft',tally.draft,'Awaiting teacher submission')+
        stat('Submitted',tally.submitted,'Awaiting review')+stat('Approved',tally.approved,'Approved entries')+stat('Published',tally.published,'Visible to students')+'</div>'+
        '<div class="principal-panel"><h3>Result Workflow</h3>'+table(['Status','Count','Meaning'],[
          row(['Draft',tally.draft,'Not yet submitted']),row(['Submitted',tally.submitted,'Submitted for review']),
          row(['Approved',tally.approved,'Approved by authorised school workflow']),row(['Published',tally.published,'Released to student portal'])
        ],'No result entries are available.')+
        '<p class="principal-muted">This is a monitoring view. Score changes, approval actions and publication remain within the existing authorised result workflow.</p></div>');
    } catch(e){root.innerHTML=frame('principalResults','<div class="principal-error">Results could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  async function renderReports(root) {
    root.innerHTML=frame('principalReports','<div class="principal-panel">Preparing academic summaries…</div>');
    try {
      var vals=await Promise.all([queryAll('results','id,total,grade,class_id,subject_id,status','created_at'),query('classes','id,class_name'),query('subjects','id,name')]);
      var results=vals[0],classes=vals[1],subjects=vals[2];
      var classRows=classes.map(function(c){var subset=results.filter(function(r){return r.class_id===c.id&&r.total!==null;});var average=subset.length?Math.round(subset.reduce(function(s,r){return s+Number(r.total||0);},0)/subset.length):0;return row([esc(c.class_name),subset.length,subset.length?average+'%':'—']);});
      var subjectRows=subjects.map(function(s){var subset=results.filter(function(r){return r.subject_id===s.id&&r.total!==null;});var average=subset.length?Math.round(subset.reduce(function(a,r){return a+Number(r.total||0);},0)/subset.length):0;return {name:s.name,count:subset.length,average:average};}).filter(function(s){return s.count;}).sort(function(a,b){return b.average-a.average;}).map(function(s){return row([esc(s.name),s.count,s.average+'%']);});
      root.innerHTML=frame('principalReports','<div class="principal-panel"><h3>Class Performance Summary</h3>'+table(['Class Arm','Result Entries','Average Score'],classRows,'No class result data is available.')+'</div>'+
        '<div class="principal-panel"><h3>Subject Performance Summary</h3>'+table(['Subject','Result Entries','Average Score'],subjectRows,'No subject result data is available.')+'</div>'+
        '<p class="principal-muted">Summaries are calculated from saved Supabase result entries. They do not alter grades or ranking records.</p>');
    }catch(e){root.innerHTML=frame('principalReports','<div class="principal-error">Academic reports could not be prepared: '+esc(e.message||e)+'</div>');}
  }
  async function renderRequests(root) {
    root.innerHTML=frame('principalRequests','<div class="principal-panel">Loading requests and audit history…</div>');
    try {
      var vals=await Promise.all([
        query('student_change_requests','id,status,reason,created_at,rejection_reason',{order:'created_at',limit:200}),
        query('school_activity_audit','id,action,affected_record,occurred_at,details',{order:'occurred_at',limit:100})
      ]);
      var req=vals[0],audit=vals[1];
      root.innerHTML=frame('principalRequests','<div class="principal-panel"><h3>Student Record Correction Requests</h3>'+
        table(['Status','Reason','Submitted'],req.map(function(r){return row(['<span class="principal-pill">'+esc(r.status)+'</span>',esc(r.reason||'—'),date(r.created_at)]);}),'No correction requests found.')+
        '<p class="principal-muted">Requests are visible for oversight. Review and decision actions remain with the currently authorised workflow.</p></div>'+
        '<div class="principal-panel"><h3>Recent School Activity</h3>'+
        table(['Activity','Affected Record','Date'],audit.map(function(a){return row([esc(a.action||'Activity'),esc(a.affected_record||'—'),date(a.occurred_at)]);}),'No audit events are available to this account.')+'</div>');
    }catch(e){root.innerHTML=frame('principalRequests','<div class="principal-error">Requests or activity could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  function renderProfile(root) {
    var s=schoolInfo||{}, c=currentSchool||{};
    root.innerHTML=frame('principalProfile','<div class="principal-panel"><h3>School Identity</h3>'+
      table(['Field','Current value'],[
        row(['School name',esc(s.name||c.schoolName||'—')]),row(['Address',esc(s.address||c.address||'—')]),
        row(['Email',esc(s.email||c.email||'—')]),row(['Phone',esc(s.phone||c.phone||'—')]),
        row(['Motto',esc(s.motto||'—')]),row(['Principal account',esc(currentUser&&currentUser.email||authenticatedProfile&&authenticatedProfile.email||'—')])
      ],'School profile is not available.')+'</div><p class="principal-muted">School identity is read from the existing Supabase school profile. Contact the Administrator for changes.</p>');
  }
  window.renderPrincipalWorkspace = function(tab) {
    if (!currentUser || currentUser.type!=='principal' || !authenticatedProfile || authenticatedProfile.is_active!==true) {
      showToast('Principal access is not authorised.','error'); return;
    }
    styleOnce();
    var root=rootFor(tab); if(!root)return;
    if(tab==='principalDashboard') renderOverview(root);
    else if(tab==='principalStudents') renderStudents(root);
    else if(tab==='principalStaff') renderStaff(root);
    else if(tab==='principalResults') renderResults(root);
    else if(tab==='principalReports') renderReports(root);
    else if(tab==='principalRequests') renderRequests(root);
    else if(tab==='principalProfile') renderProfile(root);
  };
})();
