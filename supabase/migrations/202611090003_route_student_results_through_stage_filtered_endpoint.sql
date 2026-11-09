-- Students now retrieve results only through student-results-portal,
-- which filters assessment fields by the student's release stage.
drop policy if exists "Students can view their own published results" on public.results;
