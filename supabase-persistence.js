/* DE-GLOBAL ACADEMY GBOKO — Supabase persistence foundation
 * This module deliberately does not read from or write to browser storage.
 * It relies on the existing Supabase client and authenticated user's RLS policies.
 * Never place a service-role key in browser code.
 */
(function (global) {
  'use strict';

  function create(client) {
    if (!client || typeof client.from !== 'function' || !client.auth) throw new Error('A valid Supabase client is required.');

    async function requireAuthenticatedUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (!data || !data.user) throw new Error('Your session has expired. Please sign in again.');
      return data.user;
    }
    function validateTable(table) {
      if (typeof table !== 'string' || !/^[a-z][a-z0-9_]*$/.test(table)) throw new Error('Invalid Supabase table name.');
    }
    function validateFilters(filters) {
      if (!filters || typeof filters !== 'object' || Array.isArray(filters) || Object.keys(filters).length === 0) {
        throw new Error('A non-empty filter is required for this operation.');
      }
    }
    async function select(table, options) {
      validateTable(table); await requireAuthenticatedUser();
      const opts = options || {};
      let query = client.from(table).select(opts.columns || '*');
      if (opts.filters) Object.entries(opts.filters).forEach(([key, value]) => { query = value === null ? query.is(key, null) : query.eq(key, value); });
      if (opts.orderBy) query = query.order(opts.orderBy, { ascending: opts.ascending !== false });
      if (Number.isInteger(opts.limit) && opts.limit > 0) query = query.limit(opts.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
    async function insert(table, rows, returning) {
      validateTable(table); await requireAuthenticatedUser();
      if (!rows || (Array.isArray(rows) && rows.length === 0)) throw new Error('Insert data is required.');
      const { data, error } = await client.from(table).insert(rows).select(returning || '*');
      if (error) throw error;
      return data || [];
    }
    async function update(table, values, filters, returning) {
      validateTable(table); validateFilters(filters); await requireAuthenticatedUser();
      if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length === 0) throw new Error('Update values are required.');
      let query = client.from(table).update(values);
      Object.entries(filters).forEach(([key, value]) => { query = value === null ? query.is(key, null) : query.eq(key, value); });
      const { data, error } = await query.select(returning || '*');
      if (error) throw error;
      return data || [];
    }
    async function upsert(table, rows, conflictColumns, returning) {
      validateTable(table); await requireAuthenticatedUser();
      if (!conflictColumns || typeof conflictColumns !== 'string') throw new Error('Explicit conflict columns are required for upsert.');
      const { data, error } = await client.from(table).upsert(rows, { onConflict: conflictColumns }).select(returning || '*');
      if (error) throw error;
      return data || [];
    }
    async function remove(table, filters) {
      validateTable(table); validateFilters(filters); await requireAuthenticatedUser();
      let query = client.from(table).delete();
      Object.entries(filters).forEach(([key, value]) => { query = value === null ? query.is(key, null) : query.eq(key, value); });
      const { data, error } = await query.select('id');
      if (error) throw error;
      return data || [];
    }

    async function getActiveSchoolProfile(user) {
      const result = await client.from('profiles').select('id,school_id,is_active').eq('id', user.id).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data || result.data.is_active !== true || !result.data.school_id) {
        throw new Error('An active school-linked profile is required for this audit.');
      }
      return result.data;
    }

    function normaliseSchoolProfilePatch(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('School profile changes are required.');
      }
      const allowed = ['name', 'address', 'phone', 'email', 'motto', 'logo_url'];
      const payload = {};
      Object.keys(patch).forEach(function(key) {
        if (!allowed.includes(key)) throw new Error('This school profile field cannot be changed here: ' + key);
        const value = patch[key];
        if (value !== null && typeof value !== 'string') throw new Error('Invalid value for school profile field: ' + key);
        const cleaned = value == null ? null : value.trim();
        if (cleaned != null && cleaned.length > (key === 'address' ? 500 : key === 'motto' ? 300 : 255)) {
          throw new Error('The value for ' + key + ' is too long.');
        }
        payload[key] = cleaned === '' ? null : cleaned;
      });
      if (!Object.keys(payload).length) throw new Error('No school profile changes were supplied.');
      if (Object.prototype.hasOwnProperty.call(payload, 'name') && !payload.name) {
        throw new Error('School name is required.');
      }
      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        throw new Error('Enter a valid school email address.');
      }
      return payload;
    }

    async function getSchoolProfile() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('schools')
        .select('id,name,address,phone,email,logo_url,motto,updated_at')
        .eq('id', profile.school_id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The school profile could not be read for this account.');
      return data;
    }

    async function getClasses() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('classes')
        .select('id,school_id,level,arm,class_name,created_at')
        .eq('school_id', profile.school_id)
        .order('level', { ascending: true })
        .order('arm', { ascending: true });
      if (error) throw error;
      return (data || []).map(function(row) {
        return {
          id: row.id,
          school_id: row.school_id,
          level: row.level,
          arm: row.arm,
          name: row.class_name,
          class_name: row.class_name,
          created_at: row.created_at
        };
      });
    }

    async function updateSchoolProfile(patch) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const payload = normaliseSchoolProfilePatch(patch);
      payload.updated_at = new Date().toISOString();
      const { data, error } = await client.from('schools').update(payload)
        .eq('id', profile.school_id)
        .select('id,name,address,phone,email,logo_url,motto,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No school profile was updated. Confirm that this account is an active school administrator, then refresh and try again.');
      return data;
    }

    async function auditSchoolAndClasses() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const schoolResult = await client.from('schools').select('id,name,address,phone,email,logo_url,motto').eq('id', profile.school_id).maybeSingle();
      if (schoolResult.error) throw schoolResult.error;
      if (!schoolResult.data) throw new Error('The authenticated profile school is not visible in schools. Check its record and SELECT RLS policy.');
      const classesResult = await client.from('classes').select('id,school_id,level,arm,class_name,created_at').eq('school_id', profile.school_id).order('class_name', { ascending: true });
      if (classesResult.error) throw classesResult.error;
      const rows = classesResult.data || [], seen = new Set(), duplicates = [];
      rows.forEach(row => { const key = String(row.class_name || '').trim().toLowerCase(); if (seen.has(key)) duplicates.push(row.class_name); seen.add(key); });
      return { readOnly: true, userId: user.id, profileId: profile.id, schoolId: profile.school_id, school: schoolResult.data, classCount: rows.length, classes: rows, duplicateClassNames: duplicates };
    }

    async function auditClassConfigurationReconciliation(legacyClassNames) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const [classesResult, formAssignmentsResult, teacherAssignmentsResult] = await Promise.all([
        client.from('classes').select('id,level,arm,class_name').eq('school_id', profile.school_id).order('class_name', { ascending: true }),
        client.from('form_master_assignments').select('id,class_id,academic_session_id').eq('school_id', profile.school_id),
        client.from('teacher_assignments').select('id,class_id,subject_id,academic_session_id,is_active').eq('school_id', profile.school_id)
      ]);
      for (const result of [classesResult, formAssignmentsResult, teacherAssignmentsResult]) {
        if (result.error) throw result.error;
      }
      const classes = classesResult.data || [];
      const legacyNames = Array.isArray(legacyClassNames)
        ? legacyClassNames.map(value => String(value || '').trim()).filter(Boolean)
        : [];
      const normalise = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
      const dbNames = classes.map(row => normalise(row.class_name));
      const oldNames = legacyNames.map(normalise);
      const dbSet = new Set(dbNames), oldSet = new Set(oldNames);
      const duplicates = [];
      const seen = new Set();
      classes.forEach(row => {
        const key = normalise(row.class_name);
        if (seen.has(key)) duplicates.push(row.class_name);
        seen.add(key);
      });
      return {
        readOnly: true,
        schoolId: profile.school_id,
        supabaseClassCount: classes.length,
        legacyClassCount: legacyNames.length,
        matchedClassCount: classes.filter(row => oldSet.has(normalise(row.class_name))).length,
        missingInSupabase: legacyNames.filter(name => !dbSet.has(normalise(name))),
        missingInLegacy: classes.filter(row => !oldSet.has(normalise(row.class_name))).map(row => row.class_name),
        duplicateSupabaseClassNames: duplicates,
        formMasterAssignmentCount: (formAssignmentsResult.data || []).length,
        teacherAssignmentCount: (teacherAssignmentsResult.data || []).length,
        classes: classes.map(row => ({ id: row.id, level: row.level, arm: row.arm, class_name: row.class_name }))
      };
    }

    async function auditSchoolDataCounts() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const tables = [
        ['students', 'Students'], ['student_enrolments', 'Student enrolments'],
        ['form_master_assignments', 'Form Master assignments'], ['teacher_assignments', 'Teacher/subject assignments'],
        ['school_staff_directory', 'School staff records'], ['academic_sessions', 'Academic sessions'],
        ['terms', 'Terms'], ['assessment_configurations', 'Assessment configurations']
      ];
      const checks = await Promise.all(tables.map(async ([table, label]) => {
        try {
          const result = await client.from(table).select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id);
          if (result.error) return { table, label, status: 'error', count: null, message: result.error.message };
          return { table, label, status: 'ok', count: result.count == null ? 0 : result.count };
        } catch (error) { return { table, label, status: 'error', count: null, message: error.message || 'Read failed' }; }
      }));
      return { readOnly: true, profileId: profile.id, schoolId: profile.school_id, checks,
        successfulChecks: checks.filter(item => item.status === 'ok').length,
        failedChecks: checks.filter(item => item.status === 'error').length };
    }

    async function auditStudentEnrolmentIntegrity() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      // IDs only: no names, admission numbers, contact details or other personal data are fetched.
      const [studentsResult, enrolmentsResult, classesResult, sessionsResult] = await Promise.all([
        client.from('students').select('id').eq('school_id', profile.school_id),
        client.from('student_enrolments').select('id,student_id,class_id,academic_session_id').eq('school_id', profile.school_id),
        client.from('classes').select('id').eq('school_id', profile.school_id),
        client.from('academic_sessions').select('id').eq('school_id', profile.school_id)
      ]);
      for (const result of [studentsResult, enrolmentsResult, classesResult, sessionsResult]) {
        if (result.error) throw result.error;
      }
      const students = studentsResult.data || [], enrolments = enrolmentsResult.data || [];
      const studentIds = new Set(students.map(row => row.id));
      const classIds = new Set((classesResult.data || []).map(row => row.id));
      const sessionIds = new Set((sessionsResult.data || []).map(row => row.id));
      const enrolledStudentIds = new Set();
      const enrolmentKeys = new Set();
      const duplicateStudentSessionPairs = [];
      let orphanStudentReferences = 0, missingClassReferences = 0, missingSessionReferences = 0;
      enrolments.forEach(row => {
        if (!studentIds.has(row.student_id)) orphanStudentReferences++;
        if (!classIds.has(row.class_id)) missingClassReferences++;
        if (!sessionIds.has(row.academic_session_id)) missingSessionReferences++;
        enrolledStudentIds.add(row.student_id);
        const key = String(row.student_id) + '|' + String(row.academic_session_id);
        if (enrolmentKeys.has(key)) duplicateStudentSessionPairs.push(key);
        enrolmentKeys.add(key);
      });
      const studentsWithoutAnyEnrolment = students.filter(row => !enrolledStudentIds.has(row.id)).length;
      return {
        readOnly: true, schoolId: profile.school_id,
        studentCount: students.length, enrolmentCount: enrolments.length,
        studentsWithoutAnyEnrolment, orphanStudentReferences,
        missingClassReferences, missingSessionReferences,
        duplicateStudentSessionPairs: duplicateStudentSessionPairs.length,
        classCount: classIds.size, academicSessionCount: sessionIds.size
      };
    }


    async function auditAssignmentIntegrity() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      // Fetch identifiers and assignment links only. No names or contact details are read.
      const [formMastersResult, teacherAssignmentsResult, classesResult, sessionsResult, subjectsResult] = await Promise.all([
        client.from('form_master_assignments').select('id,school_id,teacher_id,class_id,academic_session_id').eq('school_id', profile.school_id),
        client.from('teacher_assignments').select('id,school_id,teacher_id,class_id,subject_id,academic_session_id,is_active').eq('school_id', profile.school_id),
        client.from('classes').select('id').eq('school_id', profile.school_id),
        client.from('academic_sessions').select('id').eq('school_id', profile.school_id),
        client.from('subjects').select('id').eq('school_id', profile.school_id)
      ]);
      for (const result of [formMastersResult, teacherAssignmentsResult, classesResult, sessionsResult, subjectsResult]) {
        if (result.error) throw result.error;
      }

      const formMasters = formMastersResult.data || [];
      const teacherAssignments = teacherAssignmentsResult.data || [];
      const classIds = new Set((classesResult.data || []).map(row => row.id));
      const sessionIds = new Set((sessionsResult.data || []).map(row => row.id));
      const subjectIds = new Set((subjectsResult.data || []).map(row => row.id));

      function inspect(rows, type) {
        const seen = new Set();
        let missingTeacherIds = 0, missingClassReferences = 0, missingSessionReferences = 0;
        let missingSubjectReferences = 0, duplicateAssignments = 0, crossSchoolRows = 0;
        rows.forEach(row => {
          if (!row.teacher_id) missingTeacherIds++;
          if (!classIds.has(row.class_id)) missingClassReferences++;
          if (!sessionIds.has(row.academic_session_id)) missingSessionReferences++;
          if (type === 'teacher' && !subjectIds.has(row.subject_id)) missingSubjectReferences++;
          if (row.school_id !== profile.school_id) crossSchoolRows++;
          const key = type === 'form'
            ? [row.teacher_id, row.class_id, row.academic_session_id].join('|')
            : [row.teacher_id, row.class_id, row.subject_id, row.academic_session_id].join('|');
          if (seen.has(key)) duplicateAssignments++;
          seen.add(key);
        });
        return { total: rows.length, missingTeacherIds, missingClassReferences,
          missingSessionReferences, missingSubjectReferences, duplicateAssignments, crossSchoolRows };
      }

      return {
        readOnly: true, schoolId: profile.school_id,
        formMasterAssignments: inspect(formMasters, 'form'),
        teacherSubjectAssignments: inspect(teacherAssignments, 'teacher'),
        referenceCounts: { classes: classIds.size, academicSessions: sessionIds.size, subjects: subjectIds.size },
        note: 'Teacher profile existence is not independently counted because profile SELECT access is restricted by RLS. Non-null teacher IDs and database foreign keys remain the available checks.'
      };
    }


    async function auditStaffAndAcademicConfiguration() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      // Only IDs, staff identifiers and configuration metadata are fetched; no names/contact details.
      const [staffResult, termsResult, sessionsResult, classesResult, configurationsResult] = await Promise.all([
        client.from('school_staff_directory').select('id,school_id,profile_id,staff_id,gender,designation,department,qualification,specialisation,employment_type,date_employed,status,show_on_portal').eq('school_id', profile.school_id),
        client.from('terms').select('id,school_id,name,term_number,is_current').eq('school_id', profile.school_id).order('term_number'),
        client.from('academic_sessions').select('id,school_id,name,is_current').eq('school_id', profile.school_id).order('created_at'),
        client.from('classes').select('id,school_id,level,class_name').eq('school_id', profile.school_id),
        client.from('assessment_configurations').select('id,school_id,academic_session_id,term_id,class_level,is_active').eq('school_id', profile.school_id)
      ]);
      for (const result of [staffResult, termsResult, sessionsResult, classesResult, configurationsResult]) {
        if (result.error) throw result.error;
      }
      const staff = staffResult.data || [], terms = termsResult.data || [];
      const sessions = sessionsResult.data || [], classes = classesResult.data || [];
      const configurations = configurationsResult.data || [];

      function duplicateCount(rows, keyFn) {
        const seen = new Set(); let duplicates = 0;
        rows.forEach(row => { const key = keyFn(row); if (key && seen.has(key)) duplicates++; if (key) seen.add(key); });
        return duplicates;
      }
      const staffIds = staff.map(row => row.staff_id).filter(value => value != null && String(value).trim() !== '');
      const profileIds = staff.map(row => row.profile_id).filter(Boolean);
      const countPresent = field => staff.filter(row => row[field] != null && String(row[field]).trim() !== '').length;
      const distribution = field => staff.reduce((acc, row) => {
        const value = row[field] == null || String(row[field]).trim() === '' ? '(blank)' : String(row[field]).trim();
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});
      const currentTerms = terms.filter(row => row.is_current === true).length;
      const targetSessions = sessions.filter(row => /2026\s*[-/]\s*2027|2026\s*\/\s*2027|2026-2027/i.test(String(row.name || '')));
      const targetSessionIds = new Set(targetSessions.map(row => row.id));
      const firstTermCandidates = terms.filter(row => Number(row.term_number) === 1 || /^first\s*term$/i.test(String(row.name || '').trim()));
      const sessionIds = new Set(sessions.map(row => row.id));
      const termIds = new Set(terms.map(row => row.id));
      const classLevels = new Set(classes.map(row => String(row.level || row.class_name || '').trim().toLowerCase()));
      let missingSessionReferences = 0, missingTermReferences = 0, duplicateConfigKeys = 0;
      const configKeys = new Set();
      configurations.forEach(row => {
        if (!sessionIds.has(row.academic_session_id)) missingSessionReferences++;
        if (!termIds.has(row.term_id)) missingTermReferences++;
        const key = [row.academic_session_id, row.term_id, String(row.class_level || '').trim().toLowerCase()].join('|');
        if (configKeys.has(key)) duplicateConfigKeys++;
        configKeys.add(key);
      });
      const activeConfigurations = configurations.filter(row => row.is_active === true).length;
      return {
        readOnly: true, schoolId: profile.school_id,
        staff: {
          total: staff.length,
          missingStaffId: staff.filter(row => !row.staff_id || !String(row.staff_id).trim()).length,
          duplicateStaffIds: duplicateCount(staff, row => row.staff_id == null ? '' : String(row.staff_id).trim().toLowerCase()),
          duplicateProfileLinks: duplicateCount(staff, row => row.profile_id || ''),
          linkedProfileCount: profileIds.length,
          fieldCompleteness: {
            gender: countPresent('gender'),
            designation: countPresent('designation'),
            department: countPresent('department'),
            qualification: countPresent('qualification'),
            specialisation: countPresent('specialisation'),
            employmentType: countPresent('employment_type'),
            dateEmployed: countPresent('date_employed'),
            status: countPresent('status')
          },
          statusDistribution: distribution('status'),
          employmentTypeDistribution: distribution('employment_type'),
          portalVisibleCount: staff.filter(row => row.show_on_portal === true).length
        },
        sessions: {
          total: sessions.length,
          records: sessions.map(row => ({ id: row.id, name: row.name, isCurrent: row.is_current === true })),
          target2026_2027: targetSessions.map(row => ({ id: row.id, name: row.name, isCurrent: row.is_current === true }))
        },
        terms: {
          total: terms.length, currentTermCount: currentTerms,
          firstTermCandidates: firstTermCandidates.map(row => ({ id: row.id, name: row.name, termNumber: row.term_number, isCurrent: row.is_current === true })),
          targetSessionAssessmentCount: configurations.filter(row => targetSessionIds.has(row.academic_session_id)).length,
          targetSessionTermConfigurationCount: configurations.filter(row => targetSessionIds.has(row.academic_session_id) && firstTermCandidates.some(term => term.id === row.term_id)).length,
          duplicateTermNumbers: duplicateCount(terms, row => row.term_number == null ? '' : String(row.term_number)),
          termNumbers: terms.map(row => ({ termNumber: row.term_number, isCurrent: row.is_current === true }))
        },
        assessments: {
          total: configurations.length, active: activeConfigurations, inactive: configurations.length - activeConfigurations,
          missingSessionReferences, missingTermReferences, duplicateConfigurationKeys: duplicateConfigKeys,
          sessionCount: sessions.length, termCount: terms.length, classLevelCount: classLevels.size
        }
      };
    }


    async function getStaffDirectory() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('school_staff_directory')
        .select('id,school_id,profile_id,staff_id,full_name,gender,designation,department,qualification,specialisation,employment_type,phone,email,biography,photo_url,date_employed,status,show_on_portal,created_at,updated_at')
        .eq('school_id', profile.school_id).order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    function normaliseStaffRecord(record) {
      const source = record || {};
      const allowed = ['profile_id','staff_id','full_name','gender','designation','department','qualification','specialisation','employment_type','phone','email','biography','photo_url','date_employed','status','show_on_portal'];
      const result = {};
      allowed.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
      });
      if (result.staff_id != null && String(result.staff_id).trim() === '') result.staff_id = null;
      if (result.email != null && String(result.email).trim() === '') result.email = null;
      if (result.status != null && !['Active','Inactive','Suspended'].includes(result.status)) throw new Error('Invalid staff status.');
      if (!result.full_name || !String(result.full_name).trim()) throw new Error('Staff full name is required.');
      result.full_name = String(result.full_name).trim();
      return result;
    }

    async function createStaffDirectoryRecord(record) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const payload = normaliseStaffRecord(record);
      payload.school_id = profile.school_id;
      payload.created_by = user.id;
      const { data, error } = await client.from('school_staff_directory').insert(payload)
        .select('id,school_id,profile_id,staff_id,full_name,gender,designation,department,qualification,specialisation,employment_type,phone,email,biography,photo_url,date_employed,status,show_on_portal,created_at,updated_at').single();
      if (error) throw error;
      return data;
    }

    async function updateStaffDirectoryRecord(id, record) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      if (!id || typeof id !== 'string') throw new Error('A valid staff record ID is required.');
      const payload = normaliseStaffRecord(record);
      const { data, error } = await client.from('school_staff_directory').update(payload)
        .eq('id', id).eq('school_id', profile.school_id)
        .select('id,school_id,profile_id,staff_id,full_name,gender,designation,department,qualification,specialisation,employment_type,phone,email,biography,photo_url,date_employed,status,show_on_portal,created_at,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No staff record was updated. Check your access or refresh the staff list.');
      return data;
    }


    async function appendActivityAudit(entry) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const sourceEventId = String(entry && entry.sourceEventId || '').trim();
      const action = String(entry && entry.action || '').trim();
      const affectedRecord = entry && entry.affectedRecord != null ? String(entry.affectedRecord).trim() : null;
      const occurredAt = entry && entry.occurredAt ? new Date(entry.occurredAt) : new Date();
      const details = entry && entry.details && typeof entry.details === 'object' && !Array.isArray(entry.details)
        ? entry.details : {};
      if (!sourceEventId || sourceEventId.length > 160) throw new Error('A valid audit event identifier is required.');
      if (action.length < 2 || action.length > 160) throw new Error('Audit action must contain between 2 and 160 characters.');
      if (affectedRecord && affectedRecord.length > 255) throw new Error('Audit affected-record text is too long.');
      if (Number.isNaN(occurredAt.getTime())) throw new Error('Invalid audit event timestamp.');
      if (JSON.stringify(details).length > 10000) throw new Error('Audit event details are too large.');
      const payload = {
        school_id: profile.school_id,
        actor_profile_id: user.id,
        source_event_id: sourceEventId,
        action: action,
        affected_record: affectedRecord || null,
        occurred_at: occurredAt.toISOString(),
        details: details
      };
      const { data, error } = await client.from('school_activity_audit')
        .insert(payload)
        .select('id,school_id,actor_profile_id,source_event_id,action,affected_record,occurred_at,details')
        .maybeSingle();
      if (!error && data) return data;
      if (error && error.code === '23505') {
        const existing = await client.from('school_activity_audit')
          .select('id,school_id,actor_profile_id,source_event_id,action,affected_record,occurred_at,details')
          .eq('school_id', profile.school_id)
          .eq('source_event_id', sourceEventId)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return existing.data;
      }
      if (error) throw error;
      throw new Error('The audit event was not confirmed by Supabase.');
    }

    async function getActivityAudit(limit) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 500)) : 100;
      const { data, error } = await client.from('school_activity_audit')
        .select('id,actor_profile_id,source_event_id,action,affected_record,occurred_at,details')
        .eq('school_id', profile.school_id)
        .order('occurred_at', { ascending: false })
        .limit(safeLimit);
      if (error) throw error;
      return data || [];
    }


    function cleanText(value, field, maxLength, required) {
      const text = value == null ? '' : String(value).trim();
      if (required && !text) throw new Error(field + ' is required.');
      if (text.length > maxLength) throw new Error(field + ' is too long.');
      return text || null;
    }

    async function getSchoolPortalSettings() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('school_portal_settings')
        .select('school_id,welcome_enabled,welcome_text,term_weeks,portal_enabled,updated_at')
        .eq('school_id', profile.school_id).maybeSingle();
      if (error) throw error;
      return data || {
        school_id: profile.school_id, welcome_enabled: false, welcome_text: '',
        term_weeks: 12, portal_enabled: true
      };
    }

    async function saveSchoolPortalSettings(settings) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const source = settings || {};
      const weeks = Number(source.term_weeks);
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > 60) throw new Error('Term weeks must be between 1 and 60.');
      const payload = {
        school_id: profile.school_id,
        welcome_enabled: source.welcome_enabled === true,
        welcome_text: cleanText(source.welcome_text, 'Welcome text', 2000, false) || '',
        term_weeks: weeks,
        portal_enabled: source.portal_enabled !== false,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client.from('school_portal_settings')
        .upsert(payload, { onConflict: 'school_id' })
        .select('school_id,welcome_enabled,welcome_text,term_weeks,portal_enabled,updated_at').single();
      if (error) throw error;
      if (!data) throw new Error('Supabase did not confirm portal settings.');
      return data;
    }

    async function getSchoolPortalNews(options) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const opts = options || {};
      let query = client.from('school_portal_news')
        .select('id,school_id,category,title,message,published_at,is_published,created_at,updated_at')
        .eq('school_id', profile.school_id)
        .order('published_at', { ascending: false });
      if (opts.publishedOnly === true) query = query.eq('is_published', true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    async function saveSchoolPortalNews(item) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const source = item || {};
      const payload = {
        school_id: profile.school_id,
        category: cleanText(source.category || 'Announcement', 'Category', 80, true),
        title: cleanText(source.title, 'News title', 180, true),
        message: cleanText(source.message, 'News message', 12000, true),
        published_at: source.published_at ? new Date(source.published_at).toISOString() : new Date().toISOString(),
        is_published: source.is_published === true,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };
      let query;
      if (source.id) {
        query = client.from('school_portal_news').update(payload).eq('id', source.id).eq('school_id', profile.school_id);
      } else {
        payload.created_by = user.id;
        query = client.from('school_portal_news').insert(payload);
      }
      const { data, error } = await query.select('id,school_id,category,title,message,published_at,is_published,created_at,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No portal news record was saved. Refresh and try again.');
      return data;
    }

    async function deleteSchoolPortalNews(id) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      if (!id) throw new Error('A news record ID is required.');
      const { data, error } = await client.from('school_portal_news').delete()
        .eq('id', id).eq('school_id', profile.school_id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No portal news record was deleted.');
      return data.id;
    }

    async function getSchoolDutyRoster(fromDate, toDate) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      let query = client.from('school_duty_roster')
        .select('id,school_id,staff_directory_id,staff_profile_id,duty_date,duty_title,location,notes,status,created_at')
        .eq('school_id', profile.school_id).order('duty_date', { ascending: true });
      if (fromDate) query = query.gte('duty_date', fromDate);
      if (toDate) query = query.lte('duty_date', toDate);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    async function saveSchoolDutyRosterEntry(entry) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const source = entry || {};
      const payload = {
        school_id: profile.school_id,
        staff_directory_id: source.staff_directory_id || null,
        staff_profile_id: source.staff_profile_id || null,
        duty_date: cleanText(source.duty_date, 'Duty date', 10, true),
        duty_title: cleanText(source.duty_title, 'Duty title', 160, true),
        location: cleanText(source.location, 'Duty location', 160, false),
        notes: cleanText(source.notes, 'Duty notes', 2000, false),
        status: ['scheduled','completed','cancelled'].includes(source.status) ? source.status : 'scheduled'
      };
      if (!payload.staff_directory_id && !payload.staff_profile_id) throw new Error('Select a staff member for this duty.');
      let query;
      if (source.id) query = client.from('school_duty_roster').update(payload).eq('id', source.id).eq('school_id', profile.school_id);
      else { payload.created_by = user.id; query = client.from('school_duty_roster').insert(payload); }
      const { data, error } = await query.select('id,school_id,staff_directory_id,staff_profile_id,duty_date,duty_title,location,notes,status,created_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Supabase did not confirm the duty-roster save.');
      return data;
    }

    async function getSchoolIdCardSettings() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('school_id_card_settings')
        .select('school_id,valid_until,school_address,school_phone,logo_path,updated_at')
        .eq('school_id', profile.school_id).maybeSingle();
      if (error) throw error;
      return data || { school_id: profile.school_id, valid_until: null, school_address: null, school_phone: null, logo_path: null };
    }

    async function saveSchoolIdCardSettings(settings) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const source = settings || {};
      const payload = {
        school_id: profile.school_id,
        valid_until: source.valid_until || null,
        school_address: cleanText(source.school_address, 'School address', 500, false),
        school_phone: cleanText(source.school_phone, 'School phone', 40, false),
        logo_path: cleanText(source.logo_path, 'Logo storage path', 500, false),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client.from('school_id_card_settings').upsert(payload, { onConflict: 'school_id' })
        .select('school_id,valid_until,school_address,school_phone,logo_path,updated_at').single();
      if (error) throw error;
      if (!data) throw new Error('Supabase did not confirm ID-card settings.');
      return data;
    }

    async function getSchoolPortalStaffSelections() {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      const { data, error } = await client.from('school_portal_staff_selections')
        .select('id,school_id,staff_directory_id,show_name,show_designation,show_department,show_qualification,show_specialisation,show_photo,display_order,is_visible')
        .eq('school_id', profile.school_id).order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    async function saveSchoolPortalStaffSelections(selections) {
      const user = await requireAuthenticatedUser();
      const profile = await getActiveSchoolProfile(user);
      if (!Array.isArray(selections)) throw new Error('Staff selections must be a list.');
      const rows = selections.map((item, index) => ({
        school_id: profile.school_id,
        staff_directory_id: item.staff_directory_id,
        show_name: item.show_name !== false,
        show_designation: item.show_designation !== false,
        show_department: item.show_department !== false,
        show_qualification: item.show_qualification !== false,
        show_specialisation: item.show_specialisation !== false,
        show_photo: item.show_photo !== false,
        display_order: Number.isInteger(item.display_order) ? item.display_order : index,
        is_visible: item.is_visible !== false,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }));
      if (!rows.length) return [];
      const { data, error } = await client.from('school_portal_staff_selections')
        .upsert(rows, { onConflict: 'school_id,staff_directory_id' })
        .select('id,school_id,staff_directory_id,show_name,show_designation,show_department,show_qualification,show_specialisation,show_photo,display_order,is_visible');
      if (error) throw error;
      if (!data || data.length !== rows.length) throw new Error('Not all staff display selections were confirmed by Supabase.');
      return data;
    }


    return Object.freeze({ select, insert, update, upsert, remove, getSchoolProfile, updateSchoolProfile, getClasses, auditSchoolAndClasses, auditClassConfigurationReconciliation, auditSchoolDataCounts, auditStudentEnrolmentIntegrity, auditAssignmentIntegrity, auditStaffAndAcademicConfiguration, getStaffDirectory, createStaffDirectoryRecord, updateStaffDirectoryRecord, appendActivityAudit, getActivityAudit, getSchoolPortalSettings, saveSchoolPortalSettings, getSchoolPortalNews, saveSchoolPortalNews, deleteSchoolPortalNews, getSchoolDutyRoster, saveSchoolDutyRosterEntry, getSchoolIdCardSettings, saveSchoolIdCardSettings, getSchoolPortalStaffSelections, saveSchoolPortalStaffSelections });
  }
  global.SupabasePersistence = Object.freeze({ create });
})(window);
