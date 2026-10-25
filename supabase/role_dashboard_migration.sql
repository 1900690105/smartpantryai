-- Apply this migration to an existing SmartPantry AI database.
-- Back up the database first. Safe to run repeatedly for the objects defined here.

alter table public.profiles add column if not exists is_verified boolean not null default false;
update public.profiles set is_verified = true where account_type in ('household','admin');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, account_type, is_verified)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    case when new.raw_user_meta_data ->> 'account_type' in ('household','retailer','organization')
      then (new.raw_user_meta_data ->> 'account_type')::public.account_type
      else 'household'::public.account_type end,
    case when new.raw_user_meta_data ->> 'account_type' = 'household' then true else false end
  ) on conflict (id) do nothing;
  insert into public.credit_accounts (user_id, balance) values (new.id, 0) on conflict (user_id) do nothing;
  return new;
end;
$$;

create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.donation_offers(id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 300),
  status text not null default 'requested' check (status in ('requested','accepted','declined','collected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, offer_id)
);
create index if not exists donation_requests_org_created_idx on public.donation_requests(organization_id, created_at desc);

create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin');
$$;
grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.admin_list_pending_accounts()
returns table(id uuid, full_name text, account_type public.account_type, created_at timestamptz, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  return query select p.id, p.full_name, p.account_type, p.created_at, u.email::text
    from public.profiles p join auth.users u on u.id = p.id
    where p.account_type in ('retailer','organization') and p.is_verified = false order by p.created_at asc;
end;
$$;

create or replace function public.admin_set_user_verification(p_user_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set is_verified = p_verified, updated_at = now()
    where id = p_user_id and account_type in ('retailer','organization');
  if not found then raise exception 'ACCOUNT_NOT_FOUND_OR_NOT_ELIGIBLE'; end if;
end;
$$;
grant execute on function public.admin_list_pending_accounts() to authenticated;
grant execute on function public.admin_set_user_verification(uuid, boolean) to authenticated;

-- Atomic stock update. Waste requires an explicit reason. Safety-related disposal never incurs a penalty.
create or replace function public.record_inventory_event(
  p_batch_id uuid,
  p_event_type public.inventory_event_type,
  p_quantity numeric,
  p_reason text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_batch public.inventory_batches%rowtype;
  v_event uuid;
  v_reason text := left(coalesce(trim(p_reason), ''), 200);
  v_penalty integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified))) then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_event_type = 'waste' and v_reason = '' then raise exception 'WASTE_REASON_REQUIRED'; end if;

  select * into v_batch from public.inventory_batches
  where id = p_batch_id and user_id = v_user for update;
  if not found then raise exception 'BATCH_NOT_FOUND'; end if;
  if v_batch.quantity < p_quantity then raise exception 'INSUFFICIENT_STOCK'; end if;

  update public.inventory_batches
  set quantity = quantity - p_quantity, updated_at = now()
  where id = p_batch_id and user_id = v_user;

  insert into public.inventory_events(user_id, batch_id, event_type, quantity, unit, reason)
  values (v_user, p_batch_id, p_event_type, p_quantity, v_batch.unit, nullif(v_reason, ''))
  returning id into v_event;

  if p_event_type = 'waste' and lower(v_reason) not like '%safety:%'
     and lower(v_reason) not like '%spoiled%'
     and lower(v_reason) not like '%contaminat%'
     and lower(v_reason) not like '%recall%'
     and lower(v_reason) not like '%unsafe%' then
    -- A small capped prototype penalty. Production policy should use an explicit user-selected reason category.
    v_penalty := least(5, greatest(1, ceil(p_quantity)::integer));
    update public.credit_accounts set balance = greatest(0, balance - v_penalty), updated_at = now()
    where user_id = v_user and balance >= v_penalty;
    if found then
      insert into public.credit_ledger(user_id, entry_type, amount, source_event_id, reason, status)
      values (v_user, 'deduct', v_penalty, v_event, 'Recorded avoidable food waste', 'posted');
    end if;
  end if;
  return v_event;
end;
$$;

-- Donation offer records an offer only. It does not deduct inventory and does not award credits.
create or replace function public.create_donation_offer(
  p_batch_id uuid,
  p_quantity numeric,
  p_notes text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_batch public.inventory_batches%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified))) then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  select * into v_batch from public.inventory_batches
  where id = p_batch_id and user_id = v_user for update;
  if not found then raise exception 'BATCH_NOT_FOUND'; end if;
  if v_batch.quantity < p_quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
  insert into public.donation_offers(user_id,batch_id,product_name,quantity,unit,notes)
  values(v_user,p_batch_id,v_batch.product_name,p_quantity,v_batch.unit,left(coalesce(p_notes,''),300))
  returning id into v_id;
  return v_id;
end;
$$;

-- Redeem only active rewards and atomically deduct credits.
create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.account_type = 'household') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  select * into v_reward from public.rewards where id = p_reward_id and active = true;
  if not found then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  select balance into v_balance from public.credit_accounts where user_id = v_user for update;
  if coalesce(v_balance,0) < v_reward.cost_credits then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.credit_accounts set balance = balance - v_reward.cost_credits, updated_at = now()
  where user_id = v_user;
  insert into public.reward_redemptions(user_id,reward_id,cost_credits)
  values(v_user,p_reward_id,v_reward.cost_credits) returning id into v_redemption;
  insert into public.credit_ledger(user_id,entry_type,amount,source_event_id,reason,status)
  values(v_user,'redeem',v_reward.cost_credits,v_redemption,'Redeemed: ' || v_reward.name,'posted');
  return v_redemption;
end;
$$;


-- Remove self-service profile updates so users cannot promote their own account.
drop policy if exists "profile update own" on public.profiles;
revoke update on public.profiles from authenticated;

alter table public.donation_requests enable row level security;
drop policy if exists "verified organizations can view offered donations" on public.donation_offers;
create policy "verified organizations can view offered donations" on public.donation_offers for select to authenticated using (
  status = 'offered' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'organization' and p.is_verified = true)
);
drop policy if exists "admins read all pantry products" on public.pantry_products;
create policy "admins read all pantry products" on public.pantry_products for select to authenticated using ((select public.is_current_user_admin()));
drop policy if exists "admins read all donation offers" on public.donation_offers;
create policy "admins read all donation offers" on public.donation_offers for select to authenticated using ((select public.is_current_user_admin()));
drop policy if exists "organizations select own requests" on public.donation_requests;
create policy "organizations select own requests" on public.donation_requests for select to authenticated using (organization_id = (select auth.uid()));
drop policy if exists "donors select requests for own offers" on public.donation_requests;
create policy "donors select requests for own offers" on public.donation_requests for select to authenticated using (exists (select 1 from public.donation_offers d where d.id = offer_id and d.user_id = (select auth.uid())));
drop policy if exists "admins read all donation requests" on public.donation_requests;
create policy "admins read all donation requests" on public.donation_requests for select to authenticated using ((select public.is_current_user_admin()));
drop policy if exists "verified organizations request offered donations" on public.donation_requests;
create policy "verified organizations request offered donations" on public.donation_requests for insert to authenticated with check (
  organization_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'organization' and p.is_verified = true)
  and exists (select 1 from public.donation_offers d where d.id = offer_id and d.status = 'offered')
);

-- Replace permissive earlier policies with role-aware policies.
drop policy if exists "inventory own insert" on public.inventory_batches;
create policy "inventory own insert" on public.inventory_batches for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);
drop policy if exists "inventory own update" on public.inventory_batches;
create policy "inventory own update" on public.inventory_batches for update to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
) with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified))));
drop policy if exists "inventory own delete" on public.inventory_batches;
create policy "inventory own delete" on public.inventory_batches for delete to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);
drop policy if exists "owners manage own pantry products" on public.pantry_products;
create policy "owners manage own pantry products" on public.pantry_products for all to authenticated using (
  owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'retailer' and p.is_verified = true)
) with check (
  owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'retailer' and p.is_verified = true)
);
drop policy if exists "donations own insert" on public.donation_offers;
create policy "donations own insert" on public.donation_offers for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);

grant select, insert on public.donation_requests to authenticated;
