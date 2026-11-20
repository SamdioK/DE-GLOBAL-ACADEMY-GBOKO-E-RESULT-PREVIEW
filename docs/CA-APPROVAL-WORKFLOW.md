# Accumulated CA Submission and Approval Workflow

## Teacher submission

- CA components are submitted in strict order: CA1, then CA2, then CA3.
- A teacher may submit one CA component at a time. The next component becomes available after the preceding component has been submitted; it does not have to wait for approval.
- If no CA component has already been submitted, the teacher may submit CA1, CA2 and CA3 together through the atomic combined-submission function.
- Examination remains a separate submission and is unavailable until CA1, CA2 and CA3 have all received final Administrator approval.

## Form Master review

- The Form Master sees the submitted CA components for the assigned class, subject, session and term.
- The Form Master may forward one component or select multiple submitted components and forward them together.
- Forwarding moves the selected submissions to the Administrator review queue.

## Administrator review

- The Administrator sees the accumulated CA components awaiting final approval.
- The Administrator may approve one component or select multiple components from the same class, subject, session and term for combined approval.
- Combined review is atomic and processes CA components in CA1–CA2–CA3 order. If any selected review fails, the whole combined review is rolled back.
- Individual CA2 or CA3 approval requires final approval of the preceding CA component.
- Examination approval remains gated until all three CA components are finally approved.

## Supabase functions

- `save_result_assessment_stage_scores`
- `submit_result_assessment_stage`
- `submit_result_assessment_ca_bundle`
- `list_result_assessment_submissions`
- `review_result_assessment_submission`
- `review_result_assessment_submissions`

All score and approval changes are processed by Supabase database functions. The browser does not act as the persistent source of truth.
