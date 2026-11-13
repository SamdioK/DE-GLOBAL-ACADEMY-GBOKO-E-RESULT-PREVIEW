# Form Master Overall-Average Result Comments

## Purpose
The Form Master selects one encouraging academic comment based on the student's overall average across all registered subjects for the selected academic session and term. The comment is not assigned separately to each subject.

## Workflow
1. Sign in using an active Form Master account.
2. Open the Form Master Assessment screen.
3. Select the academic term and an officially enrolled student.
4. The system retrieves the class's registered subject list and the student's subject results from Supabase.
5. The system waits until every registered subject has a result in `submitted`, `approved` or `published` status. Draft, rejected or missing results are not treated as final.
6. The system adds the subject totals and divides by the total obtainable marks, using the active assessment configuration for that class and term.
7. The overall average determines the rating:
   - Rating 5: 75–100
   - Rating 4: 65–74.99
   - Rating 3: 55–64.99
   - Rating 2: 40–54.99
   - Rating 1: below 40
8. The Form Master selects one of the ten comments available for that rating.
9. The Form Master completes attendance, fees, affective and psychomotor ratings as applicable, then saves the assessment.
10. The application verifies the saved record by reading it back from Supabase. The saved Form Master comment is loaded again when the result sheet is prepared for printing.

## Comment bank
The ten approved comments for each rating are embedded in the Form Master assessment interface. Rating 1 comments are deliberately supportive and do not condemn or label the student.

## Data and security
- Subject scores are read from `public.results`.
- The expected subject list is read from `public.class_subject_registrations` and `public.class_subject_registration_items`.
- The selected comment and Form Master assessment are stored in `public.form_master_student_assessments.form_master_comment` and the existing assessment fields.
- The workflow uses the signed-in user's Supabase session and existing Row Level Security. It does not create browser or device storage and does not alter subject scores.
- The printed result sheet retrieves the saved Form Master assessment from Supabase using the official student, session and term identifiers.

## Important behaviour
- The overall average and comment selector remain unavailable until all registered subjects have finalised results.
- Draft results are not counted.
- The comment selector only offers comments for the calculated rating.
- If the saved comment is an older free-text comment or does not belong to the current rating, the Form Master must choose a current approved comment before saving.
- If the subject registration, assessment configuration or result records cannot be read, the interface reports that the overall average cannot be confirmed. It must not invent or estimate a rating.

## Troubleshooting
- **Waiting for all subject results:** ask the relevant subject teachers or administrator to submit the remaining registered subject results.
- **Subject registration unavailable:** ask the School Administrator to check the class subject registration for the selected session and term.
- **Assessment configuration unavailable:** ask the School Administrator to confirm the active CA and examination maximums.
- **Could not calculate the overall average:** refresh the page, verify the selected term and check Supabase access to the class registration and results records.
- **Save not confirmed:** do not assume the assessment was saved. Check the Supabase record before retrying.

## Verification checklist
- Confirm each registered subject has a submitted, approved or published result.
- Confirm the displayed subject count matches the registered subject count.
- Check the overall average and rating band.
- Select a comment from the correct rating.
- Save and confirm the success message reports Supabase verification.
- Open or print the student's result and confirm the same Form Master comment appears.
