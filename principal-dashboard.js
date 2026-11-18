/* Principal's read-only oversight dashboard.
 * All displayed records are queried from Supabase using the signed-in Principal's
 * school_id. This module intentionally contains no write operations.
 */
(function () {
  'use strict';
  var sections = {
    principalDashboard: ['Principal Overview', 'A live executive summary of the school.'],
    principalStudents: ['Student Database', 'Official student names arranged by class arm and register order.'],
    principalStaff: ['Staff & Teachers', 'Staff directory, designations and employment information.'],
    principalResults: ['Broadsheet Review', 'Interactive class broadsheets, aggregates, averages and rankings before publication.'],
    principalSubmission: ['Submission Tracker', 'Live CA and examination upload progress by class, subject and teacher.'],
    principalReports: ['Statistical Analysis', 'School-wide enrolment, attendance and academic performance analysis.'],
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
      .principal-filter-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.principal-filter-row label{font-size:12px;font-weight:700;color:#52665e}.principal-filter-row select{display:block;width:100%;min-height:40px;margin-top:5px;padding:8px;border:1px solid #d5e1db;border-radius:8px;background:#fff}.principal-arm-group{margin-top:16px}.principal-arm-group h4{display:flex;justify-content:space-between;padding:10px 12px;background:#eef5f1;color:#175b49;border-radius:8px}.principal-arm-group h4 small{color:#70827a}.principal-arm-group ol{columns:2;padding-left:30px}.principal-arm-group li{padding:6px 4px;border-bottom:1px solid #edf1ee;break-inside:avoid;font-size:13px}.principal-progress{min-width:110px}.principal-progress-label{font-size:10px;color:#64756d}.principal-progress .principal-bar{margin-top:4px}.principal-pill.principal-done{background:#e4f6eb;color:#176b45}.principal-pill.principal-pending{background:#fff3d9;color:#8a5b00}.principal-analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.principal-analysis-row{display:grid;grid-template-columns:minmax(80px,130px) 1fr 36px;align-items:center;gap:9px;margin:10px 0;font-size:11px}.principal-analysis-row .principal-bar{margin:0}.principal-analysis-row>b{text-align:right;color:#38564c}
      @media(max-width:600px){.principal-filter-row{grid-template-columns:1fr}.principal-arm-group ol{columns:1}.principal-analysis-grid{grid-template-columns:1fr}.principal-analysis-row{grid-template-columns:90px 1fr 34px}}
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
      // Delegate the Overview quick-access actions to the existing authorised tab router.
      // Assigning onclick replaces any previous handler, avoiding duplicate listeners on refresh.
      root.onclick = function(event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-principal-go]') : null;
        if (!button || !root.contains(button)) return;
        var destination = button.getAttribute('data-principal-go');
        var allowed = ['principalStudents','principalStaff','principalResults','principalReports','principalRequests'];
        if (allowed.indexOf(destination) === -1) return;
        if (typeof showTab === 'function') showTab(destination);
        else showToast('Navigation is temporarily unavailable. Please refresh and try again.', 'error');
      };
    } catch(e) { root.innerHTML=frame('principalDashboard','<div class="principal-error">Dashboard data could not be loaded: '+esc(e.message||e)+'</div>'); }
  }
  async function renderStudents(root) {
    root.innerHTML=frame('principalStudents','<div class="principal-panel">Loading official student register…</div>');
    try {
      var sessions=await query('academic_sessions','id,name,is_current',{order:'created_at',limit:30});
      var active=sessions.find(function(x){return x.is_current;})||sessions[0];
      if(!active)throw new Error('No academic session is configured.');
      var all=[],offset=0,batch;
      do {
        var result=await supabaseClient.from('student_enrolments')
          .select('student_id,class_id,register_number,students!inner(first_name,middle_name,last_name),classes!inner(class_name)')
          .eq('school_id',authenticatedProfile.school_id).eq('academic_session_id',active.id).is('archived_at',null)
          .order('class_id',{ascending:true}).order('register_number',{ascending:true})
          .range(offset,offset+999);
        if(result.error)throw result.error;
        batch=result.data||[];all=all.concat(batch);offset+=batch.length;
      } while(batch.length===1000);
      all.sort(function(a,b){return String(a.classes&&a.classes.class_name||'').localeCompare(String(b.classes&&b.classes.class_name||''))||Number(a.register_number||0)-Number(b.register_number||0);});
      var groups={};all.forEach(function(e){var name=e.classes&&e.classes.class_name||'Unassigned';(groups[name]||(groups[name]=[])).push(e);});
      var body='<div class="principal-panel"><div class="principal-section-title"><h3>Official Student Register</h3><span class="principal-pill">'+all.length+' students</span></div><p class="principal-muted">Names only, arranged by class arm and official register number. This view is read-only.</p>';
      Object.keys(groups).sort().forEach(function(name){body+='<div class="principal-arm-group"><h4>'+esc(name)+' <small>'+groups[name].length+'</small></h4><ol>'+groups[name].map(function(e){var st=e.students||{};return '<li>'+esc([st.first_name,st.middle_name,st.last_name].filter(Boolean).join(' '))+'</li>';}).join('')+'</ol></div>';});
      body+='</div>';
      root.innerHTML=frame('principalStudents',body);
    } catch(e){root.innerHTML=frame('principalStudents','<div class="principal-error">Student register could not be loaded: '+esc(e.message||e)+'</div>');}
  }
    async function renderStaff(root) {
    root.innerHTML=frame('principalStaff','<div class="principal-panel">Loading staff directory…</div>');
    try {
      var rows=await query('school_staff_directory','id,staff_id,full_name,designation,department,employment_type,status',{order:'created_at',limit:500});
      root.innerHTML=frame('principalStaff','<div class="principal-panel"><div class="principal-section-title"><h3>Staff & Teachers</h3><span class="principal-pill">'+rows.length+' shown</span></div>'+
        table(['Staff ID','Name','Designation','Department','Employment','Status'],rows.map(function(s){return row([esc(s.staff_id||'—'),esc(s.full_name),esc(s.designation||'—'),esc(s.department||'—'),esc(s.employment_type||'—'),'<span class="principal-pill">'+esc(s.status||'—')+'</span>']);}),'No staff directory records are available.')+'</div>');
    } catch(e){root.innerHTML=frame('principalStaff','<div class="principal-error">Staff records could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  var principalFilters={sessionId:'',termId:'',classId:''};
  async function getAcademicFilters() {
    var vals=await Promise.all([query('academic_sessions','id,name,is_current',{order:'created_at',limit:30}),query('terms','id,name,term_number,is_current',{limit:12}),query('classes','id,class_name',{order:'created_at',limit:100})]);
    var sessions=vals[0],terms=vals[1],classes=vals[2];
    if(!sessions.some(function(x){return x.id===principalFilters.sessionId;}))principalFilters.sessionId=(sessions.find(function(x){return x.is_current;})||sessions[0]||{}).id||'';
    if(!terms.some(function(x){return x.id===principalFilters.termId;}))principalFilters.termId=(terms.find(function(x){return x.is_current;})||terms.sort(function(a,b){return Number(a.term_number)-Number(b.term_number);})[0]||{}).id||'';
    if(!classes.some(function(x){return x.id===principalFilters.classId;}))principalFilters.classId=(classes[0]||{}).id||'';
    return {sessions:sessions,terms:terms,classes:classes};
  }
  function filterMarkup(f,withClass) {
    var h='<div class="principal-filter-row"><label>Academic Session<select data-pf="session">'+f.sessions.map(function(x){return '<option value="'+esc(x.id)+'" '+(x.id===principalFilters.sessionId?'selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select></label><label>Term<select data-pf="term">'+f.terms.map(function(x){return '<option value="'+esc(x.id)+'" '+(x.id===principalFilters.termId?'selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select></label>';
    if(withClass)h+='<label>Class Arm<select data-pf="class">'+f.classes.map(function(x){return '<option value="'+esc(x.id)+'" '+(x.id===principalFilters.classId?'selected':'')+'>'+esc(x.class_name)+'</option>';}).join('')+'</select></label>';
    return h+'</div>';
  }
  function bindFilterEvents(root,tab,withClass) {
    root.querySelectorAll('[data-pf]').forEach(function(el){el.addEventListener('change',function(){var k=el.getAttribute('data-pf');if(k==='session')principalFilters.sessionId=el.value;if(k==='term')principalFilters.termId=el.value;if(k==='class')principalFilters.classId=el.value;showTab(tab);});});
  }
  async function renderResults(root) {
    root.innerHTML=frame('principalResults','<div class="principal-panel">Preparing interactive broadsheet…</div>');
    try {
      var f=await getAcademicFilters();
      var vals=await Promise.all([
        queryAll('results','id,status,total,grade,student_id,class_id,subject_id,academic_session_id,term_id','created_at'),
        supabaseClient.from('student_enrolments').select('student_id,class_id,register_number,students!inner(first_name,middle_name,last_name)').eq('school_id',authenticatedProfile.school_id).eq('academic_session_id',principalFilters.sessionId).is('archived_at',null).order('register_number',{ascending:true}),
        query('subjects','id,name'),
        supabaseClient.from('teacher_assignments').select('subject_id').eq('school_id',authenticatedProfile.school_id).eq('academic_session_id',principalFilters.sessionId).eq('class_id',principalFilters.classId).eq('is_active',true)
      ]);
      if(vals[1].error)throw vals[1].error;
      if(vals[3].error)throw vals[3].error;
      var results=vals[0].filter(function(r){return r.academic_session_id===principalFilters.sessionId&&r.term_id===principalFilters.termId&&r.class_id===principalFilters.classId;});
      var enrolments=vals[1].data||[],classStudents=enrolments.filter(function(e){return e.class_id===principalFilters.classId;}).sort(function(a,b){return Number(a.register_number||0)-Number(b.register_number||0);});
      var subjects=vals[2],ids=[...new Set(results.map(function(r){return r.subject_id;}).concat((vals[3].data||[]).map(function(a){return a.subject_id;})))],subjectMap={};
      subjects.forEach(function(x){subjectMap[x.id]=x.name;});
      var board=classStudents.map(function(e){var scores={},values=[];results.filter(function(r){return r.student_id===e.student_id;}).forEach(function(r){scores[r.subject_id]=r.total;if(r.total!==null&&r.total!==undefined&&r.total!=='')values.push(Number(r.total));});var aggregate=values.reduce(function(a,b){return a+b;},0);return {name:[e.students.first_name,e.students.middle_name,e.students.last_name].filter(Boolean).join(' '),reg:Number(e.register_number||0),scores:scores,aggregate:aggregate,average:values.length?aggregate/values.length:null};}).sort(function(a,b){if(a.average===null&&b.average!==null)return 1;if(b.average===null&&a.average!==null)return -1;return (b.average||0)-(a.average||0)||a.reg-b.reg;});
      var last=null,rank=0;board.forEach(function(x,i){if(x.average!==null&&x.average!==last)rank=i+1;x.rank=x.average===null?'—':rank;last=x.average;});
      var body=filterMarkup(f,true)+'<div class="principal-panel"><div class="principal-section-title"><h3>Master Broadsheet</h3><span class="principal-pill">'+classStudents.length+' students</span></div><p class="principal-muted">Review saved subject totals, aggregates, averages and class positions before publication. This screen cannot edit or publish marks.</p><div class="principal-table-wrap"><table class="principal-table"><thead><tr><th>Student</th>'+ids.map(function(id){return '<th>'+esc(subjectMap[id]||'Subject')+'</th>';}).join('')+'<th>Aggregate</th><th>Average</th><th>Rank</th></tr></thead><tbody>';
      board.forEach(function(x){body+='<tr><td>'+esc(x.name)+'</td>'+ids.map(function(id){var v=x.scores[id];return '<td>'+(v==null||v===''?'—':esc(v))+'</td>';}).join('')+'<td>'+x.aggregate.toFixed(1)+'</td><td>'+(x.average===null?'—':x.average.toFixed(1))+'</td><td>'+x.rank+'</td></tr>';});
      body+='</tbody></table></div></div>';
      root.innerHTML=frame('principalResults',body);bindFilterEvents(root,'principalResults',true);
    } catch(e){root.innerHTML=frame('principalResults','<div class="principal-error">Broadsheet could not be loaded: '+esc(e.message||e)+'</div>');}
  }
    async function renderSubmissionTracker(root) {
    root.innerHTML=frame('principalSubmission','<div class="principal-panel">Loading teacher submission progress…</div>');
    try {
      var f=await getAcademicFilters();
      var vals=await Promise.all([
        queryAll('teacher_assignments','id,teacher_id,class_id,subject_id,academic_session_id,is_active','created_at'),
        queryAll('results','id,student_id,class_id,subject_id,academic_session_id,term_id,ca1,ca2,ca3,examination,status','created_at'),
        queryAll('student_enrolments','id,student_id,class_id,academic_session_id,archived_at','created_at'),
        query('assessment_configurations','class_level,ca1_max,ca2_max,ca3_max',{eq:{academic_session_id:principalFilters.sessionId,term_id:principalFilters.termId},limit:100}),
        query('profiles','id,full_name,role,is_active',{limit:1000}),
        query('classes','id,class_name,level'),
        query('subjects','id,name')
      ]);
      var assignments=vals[0].filter(function(a){return a.academic_session_id===principalFilters.sessionId&&a.is_active!==false;}),results=vals[1].filter(function(r){return r.academic_session_id===principalFilters.sessionId&&r.term_id===principalFilters.termId;}),enrol=vals[2].filter(function(e){return e.academic_session_id===principalFilters.sessionId&&!e.archived_at;}),configs=vals[3],profiles=vals[4],classes=vals[5],subjects=vals[6],teacherMap={},classMap={},subjectMap={},countMap={},configMap={};
      profiles.forEach(function(p){teacherMap[p.id]=p.full_name;});classes.forEach(function(c){classMap[c.id]=c;});subjects.forEach(function(x){subjectMap[x.id]=x.name;});enrol.forEach(function(e){countMap[e.class_id]=(countMap[e.class_id]||0)+1;});configs.forEach(function(c){configMap[String(c.class_level)]=c;});
      var rows=assignments.map(function(a){var c=classMap[a.class_id]||{},cfg=configMap[String(c.level||'')]||{},caFields=['ca1','ca2','ca3'].filter(function(k){return Number(cfg[k+'_max']||0)>0;}),total=countMap[a.class_id]||0,records=results.filter(function(r){return r.class_id===a.class_id&&r.subject_id===a.subject_id;});var ca=records.filter(function(r){return caFields.length?caFields.every(function(k){return r[k]!==null&&r[k]!==undefined&&r[k]!=='';}):[r.ca1,r.ca2,r.ca3].some(function(v){return v!==null&&v!==undefined&&v!=='';});}).length,exam=records.filter(function(r){return r.examination!==null&&r.examination!==undefined&&r.examination!=='';}).length;return {className:c.class_name||'Class',subject:subjectMap[a.subject_id]||'Subject',teacher:teacherMap[a.teacher_id]||'Unassigned teacher',total:total,ca:Math.min(ca,total),exam:Math.min(exam,total)};}).sort(function(a,b){return a.className.localeCompare(b.className)||a.subject.localeCompare(b.subject);});
      var total=rows.reduce(function(n,x){return n+x.total;},0),ca=rows.reduce(function(n,x){return n+x.ca;},0),exam=rows.reduce(function(n,x){return n+x.exam;},0);
      var body=filterMarkup(f,false)+'<div class="principal-grid">'+stat('Teacher-subject assignments',rows.length,'Active teaching allocations')+stat('Expected student entries',total,'Across assigned class subjects')+stat('CA entries completed',ca,'Based on configured CA components')+stat('Examination entries completed',exam,'Examination score records')+'</div><div class="principal-panel"><div class="principal-section-title"><h3>Submission Progress by Teacher</h3><span class="principal-pill">'+rows.length+' assignments</span></div>'+table(['Class Arm','Subject','Teacher','CA Progress','Exam Progress','Status'],rows.map(function(x){var cp=x.total?Math.round(x.ca/x.total*100):0,ep=x.total?Math.round(x.exam/x.total*100):0,done=x.total>0&&x.ca>=x.total&&x.exam>=x.total;return row([esc(x.className),esc(x.subject),esc(x.teacher),'<div class="principal-progress"><div class="principal-progress-label">CA · '+x.ca+'/'+x.total+'</div><div class="principal-bar"><span style="width:'+cp+'%"></span></div></div>','<div class="principal-progress"><div class="principal-progress-label">Exam · '+x.exam+'/'+x.total+'</div><div class="principal-bar"><span style="width:'+ep+'%"></span></div></div>','<span class="principal-pill '+(done?'principal-done':'principal-pending')+'">'+(done?'Complete':'Outstanding')+'</span>']);}),'No active teacher-subject assignments were found.')+'</div>';
      root.innerHTML=frame('principalSubmission',body);bindFilterEvents(root,'principalSubmission',false);
    }catch(e){root.innerHTML=frame('principalSubmission','<div class="principal-error">Submission progress could not be loaded: '+esc(e.message||e)+'</div>');}
  }
  async function renderReports(root) {
    root.innerHTML=frame('principalReports','<div class="principal-panel">Preparing school statistical analysis…</div>');
    try {
      var f=await getAcademicFilters();
      var vals=await Promise.all([
        queryAll('results','id,total,grade,class_id,subject_id,status,academic_session_id,term_id,ca1,ca2,ca3,examination','created_at'),
        query('classes','id,class_name'),query('subjects','id,name'),
        supabaseClient.from('student_enrolments').select('student_id,class_id,students!inner(gender)').eq('school_id',authenticatedProfile.school_id).eq('academic_session_id',principalFilters.sessionId).is('archived_at',null),
        supabaseClient.from('form_master_student_assessments').select('class_id,attendance_days,school_days').eq('school_id',authenticatedProfile.school_id).eq('academic_session_id',principalFilters.sessionId).eq('term_id',principalFilters.termId)
      ]);
      if(vals[3].error)throw vals[3].error;
      var results=vals[0].filter(function(r){return r.academic_session_id===principalFilters.sessionId&&r.term_id===principalFilters.termId;}),classes=vals[1],subjects=vals[2],enrol=vals[3].data||[],attendance=vals[4].error?[]:(vals[4].data||[]);
      var scored=results.filter(function(r){return r.total!==null&&r.total!==undefined&&r.total!=='';}),mean=scored.length?scored.reduce(function(n,r){return n+Number(r.total||0);},0)/scored.length:0,grades={},workflow={},gender={Male:0,Female:0,Other:0},classAvg={},subjectAvg={};
      scored.forEach(function(r){var g=String(r.grade||'Ungraded');grades[g]=(grades[g]||0)+1;[classAvg[r.class_id]||(classAvg[r.class_id]=[]),subjectAvg[r.subject_id]||(subjectAvg[r.subject_id]=[])].forEach(function(a){a.push(Number(r.total));});});
      results.forEach(function(r){var st=String(r.status||'draft').toLowerCase();workflow[st]=(workflow[st]||0)+1;});
      enrol.forEach(function(e){var g=String(e.students&&e.students.gender||'').toLowerCase();gender[g==='male'?'Male':g==='female'?'Female':'Other']++;});
      var caVals=[],examVals=[];results.forEach(function(r){['ca1','ca2','ca3'].forEach(function(k){if(r[k]!=null&&r[k]!=='')caVals.push(Number(r[k]));});if(r.examination!=null&&r.examination!=='')examVals.push(Number(r.examination));});
      var days=attendance.reduce(function(n,x){return n+Number(x.attendance_days||0);},0),possible=attendance.reduce(function(n,x){return n+Number(x.school_days||0);},0);
      function bars(obj,total){return Object.keys(obj).sort().map(function(k){var n=obj[k],p=total?Math.round(n/total*100):0;return '<div class="principal-analysis-row"><span>'+esc(k)+'</span><div class="principal-bar"><span style="width:'+p+'%"></span></div><b>'+n+'</b></div>';}).join('');}
      var classRows=classes.map(function(c){var a=classAvg[c.id]||[],avg=a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;return {name:c.class_name,avg:avg};}).filter(function(x){return x.avg!==null;}).sort(function(a,b){return b.avg-a.avg;});
      var subjectRows=subjects.map(function(c){var a=subjectAvg[c.id]||[],avg=a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;return {name:c.name,avg:avg};}).filter(function(x){return x.avg!==null;}).sort(function(a,b){return b.avg-a.avg;});
      root.innerHTML=frame('principalReports',filterMarkup(f,false)+'<div class="principal-grid">'+stat('Active enrolments',enrol.length,'Selected academic session')+stat('Recorded subject scores',scored.length,'Selected term')+stat('Mean subject score',mean.toFixed(1),'Across recorded totals')+stat('Mean CA score',caVals.length?(caVals.reduce(function(a,b){return a+b;},0)/caVals.length).toFixed(1):'—','Available CA components')+stat('Mean examination score',examVals.length?(examVals.reduce(function(a,b){return a+b;},0)/examVals.length).toFixed(1):'—','Recorded examination scores')+stat('Attendance rate',possible?Math.round(days/possible*100)+'%':'—','From Form Master attendance records')+'</div>'+
        '<div class="principal-analysis-grid"><div class="principal-panel"><h3>Enrolment by Gender</h3>'+bars(gender,enrol.length)+'</div><div class="principal-panel"><h3>Grade Distribution</h3>'+bars(grades,scored.length)+'</div><div class="principal-panel"><h3>Result Workflow</h3>'+bars(workflow,results.length)+'</div><div class="principal-panel"><h3>Average by Class Arm</h3>'+classRows.map(function(x){return '<div class="principal-analysis-row"><span>'+esc(x.name)+'</span><div class="principal-bar"><span style="width:'+Math.max(0,Math.min(100,x.avg))+'%"></span></div><b>'+x.avg.toFixed(1)+'</b></div>';}).join('')+'</div><div class="principal-panel"><h3>Average by Subject</h3>'+subjectRows.map(function(x){return '<div class="principal-analysis-row"><span>'+esc(x.name)+'</span><div class="principal-bar"><span style="width:'+Math.max(0,Math.min(100,x.avg))+'%"></span></div><b>'+x.avg.toFixed(1)+'</b></div>';}).join('')+'</div></div>'+
        '<p class="principal-muted">All indicators are calculated from the selected session and term. Missing or unrecorded values are excluded rather than treated as zero.</p>');
      bindFilterEvents(root,'principalReports',false);
    }catch(e){root.innerHTML=frame('principalReports','<div class="principal-error">Statistical analysis could not be prepared: '+esc(e.message||e)+'</div>');}
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
    else if(tab==='principalSubmission') renderSubmissionTracker(root);
    else if(tab==='principalReports') renderReports(root);
    else if(tab==='principalRequests') renderRequests(root);
    else if(tab==='principalProfile') renderProfile(root);
  };
})();
