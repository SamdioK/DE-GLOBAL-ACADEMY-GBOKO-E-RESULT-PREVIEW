-- Term-bound student result tokens. Each purchase grants five non-expiring checks
-- for exactly one student + academic session + term combination.
create table if not exists public.student_result_token_balances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  purchased_uses integer not null default 0 check (purchased_uses >= 0),
  remaining_uses integer not null default 0 check (remaining_uses >= 0 and remaining_uses <= purchased_uses),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_result_token_balance_scope_unique
    unique (school_id, student_id, academic_session_id, term_id)
);

create index if not exists idx_student_result_token_balance_student
  on public.student_result_token_balances (school_id, student_id, academic_session_id, term_id);

create table if not exists public.student_result_token_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  reference text not null unique,
  amount_kobo integer not null default 65199 check (amount_kobo = 65199),
  currency text not null default 'NGN' check (currency = 'NGN'),
  token_uses integer not null default 5 check (token_uses = 5),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','success','failed','abandoned','reversed','unknown')),
  paystack_transaction_id text,
  gateway_response text,
  paid_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_result_token_purchases_student
  on public.student_result_token_purchases (school_id, student_id, academic_session_id, term_id, created_at desc);

create table if not exists public.student_result_token_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  event_type text not null check (event_type in ('purchase_credit','result_check')),
  uses_delta integer not null check (uses_delta in (-1, 5)),
  balance_after integer not null check (balance_after >= 0),
  payment_reference text,
  request_key uuid,
  created_at timestamptz not null default now(),
  constraint student_result_token_event_type_reference_check check (
    (event_type = 'purchase_credit' and uses_delta = 5 and payment_reference is not null and request_key is null)
    or
    (event_type = 'result_check' and uses_delta = -1 and payment_reference is null and request_key is not null)
  )
);

create unique index if not exists uq_student_result_token_purchase_credit
  on public.student_result_token_events (payment_reference)
  where event_type = 'purchase_credit';
create unique index if not exists uq_student_result_token_request
  on public.student_result_token_events (request_key)
  where event_type = 'result_check';
create index if not exists idx_student_result_token_events_scope
  on public.student_result_token_events (school_id, student_id, academic_session_id, term_id, created_at desc);

alter table public.student_result_token_balances enable row level security;
alter table public.student_result_token_purchases enable row level security;
alter table public.student_result_token_events enable row level security;
revoke all on public.student_result_token_balances from anon, authenticated;
revoke all on public.student_result_token_purchases from anon, authenticated;
revoke all on public.student_result_token_events from anon, authenticated;
grant all on public.student_result_token_balances to service_role;
grant all on public.student_result_token_purchases to service_role;
grant all on public.student_result_token_events to service_role;

-- Credit a verified successful purchase once only. This function is callable by service_role only.
create or replace function public.credit_student_result_token_purchase(p_reference text)
returns table (remaining_uses integer, credited boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_purchase public.student_result_token_purchases%rowtype;
  v_remaining integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('result-token-purchase:' || p_reference, 0));

  select * into v_purchase
  from public.student_result_token_purchases
  where reference = p_reference
  for update;

  if not found then raise exception 'Token purchase not found'; end if;
  if v_purchase.payment_status <> 'success' then raise exception 'Payment has not been verified as successful'; end if;

  if v_purchase.credited_at is not null then
    select b.remaining_uses into v_remaining
    from public.student_result_token_balances b
    where b.school_id = v_purchase.school_id
      and b.student_id = v_purchase.student_id
      and b.academic_session_id = v_purchase.academic_session_id
      and b.term_id = v_purchase.term_id;
    return query select coalesce(v_remaining, 0), false;
    return;
  end if;

  insert into public.student_result_token_balances
    (school_id, student_id, academic_session_id, term_id, purchased_uses, remaining_uses)
  values
    (v_purchase.school_id, v_purchase.student_id, v_purchase.academic_session_id, v_purchase.term_id,
     v_purchase.token_uses, v_purchase.token_uses)
  on conflict (school_id, student_id, academic_session_id, term_id)
  do update set
    purchased_uses = student_result_token_balances.purchased_uses + excluded.purchased_uses,
    remaining_uses = student_result_token_balances.remaining_uses + excluded.remaining_uses,
    updated_at = now()
  returning remaining_uses into v_remaining;

  insert into public.student_result_token_events
    (school_id, student_id, academic_session_id, term_id, event_type, uses_delta, balance_after, payment_reference)
  values
    (v_purchase.school_id, v_purchase.student_id, v_purchase.academic_session_id, v_purchase.term_id,
     'purchase_credit', v_purchase.token_uses, v_remaining, v_purchase.reference);

  update public.student_result_token_purchases
  set credited_at = now(), updated_at = now()
  where id = v_purchase.id;

  return query select v_remaining, true;
end;
$$;

-- Consume exactly one check for the selected term. A request UUID makes retries idempotent.
create or replace function public.consume_student_result_token(
  p_school_id uuid,
  p_student_id uuid,
  p_academic_session_id uuid,
  p_term_id uuid,
  p_request_key uuid
)
returns table (remaining_uses integer, consumed boolean, already_processed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.student_result_token_events%rowtype;
  v_remaining integer;
begin
  if p_request_key is null then raise exception 'A result-check request key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('result-token-request:' || p_request_key::text, 0));

  select * into v_existing
  from public.student_result_token_events
  where request_key = p_request_key and event_type = 'result_check';

  if found then
    if v_existing.school_id <> p_school_id or v_existing.student_id <> p_student_id
      or v_existing.academic_session_id <> p_academic_session_id or v_existing.term_id <> p_term_id then
      raise exception 'Result-check request key scope mismatch';
    end if;
    return query select v_existing.balance_after, true, true;
    return;
  end if;

  update public.student_result_token_balances
  set remaining_uses = remaining_uses - 1, updated_at = now()
  where school_id = p_school_id
    and student_id = p_student_id
    and academic_session_id = p_academic_session_id
    and term_id = p_term_id
    and remaining_uses > 0
  returning remaining_uses into v_remaining;

  if not found then
    return query select 0, false, false;
    return;
  end if;

  insert into public.student_result_token_events
    (school_id, student_id, academic_session_id, term_id, event_type, uses_delta, balance_after, request_key)
  values
    (p_school_id, p_student_id, p_academic_session_id, p_term_id, 'result_check', -1, v_remaining, p_request_key);

  return query select v_remaining, true, false;
end;
$$;

revoke all on function public.credit_student_result_token_purchase(text) from public, anon, authenticated;
revoke all on function public.consume_student_result_token(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.credit_student_result_token_purchase(text) to service_role;
grant execute on function public.consume_student_result_token(uuid, uuid, uuid, uuid, uuid) to service_role;
