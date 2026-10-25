-- SmartPantry AI schema for Supabase PostgreSQL.
-- Run this in Supabase SQL Editor on a new project. Do not expose service-role keys in the browser.

create extension if not exists pgcrypto;

create type public.account_type as enum ('household', 'retailer', 'organization', 'admin');
create type public.inventory_event_type as enum ('consume', 'waste', 'sale');
create type public.donation_status as enum ('offered', 'accepted', 'collected', 'received', 'cancelled');
create type public.credit_entry_type as enum ('earn', 'deduct', 'redeem', 'reverse', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type public.account_type not null default 'household',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
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

  insert into public.credit_accounts (user_id, balance)
  values (new.id, 0) on conflict (user_id) do nothing;
  return new;
end;
$$;

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null check (char_length(product_name) between 1 and 120),
  quantity numeric(14,3) not null check (quantity >= 0),
  unit text not null check (unit in ('pcs','pack','g','kg','ml','l')),
  expiry_date date,
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  source text not null default 'manual' check (source in ('manual','barcode')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_batches_user_created_idx on public.inventory_batches(user_id, created_at desc);
create index inventory_batches_user_expiry_idx on public.inventory_batches(user_id, expiry_date);

-- Grocery-owner product catalogue. QR codes contain only the UUID-based product URL.
create table public.pantry_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (category in ('vegetable','fruit','grain','dairy','other')),
  price numeric(12,2) not null default 0 check (price >= 0),
  unit text not null default 'kg' check (unit in ('pcs','kg','g','pack')),
  nutrition_notes text check (nutrition_notes is null or char_length(nutrition_notes) <= 1000),
  source_type text not null default 'owner_qr' check (source_type in ('owner_qr','open_food_facts')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pantry_products_owner_created_idx on public.pantry_products(owner_id, created_at desc);

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  event_type public.inventory_event_type not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index inventory_events_user_created_idx on public.inventory_events(user_id, created_at desc);

create table public.donation_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  product_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  notes text,
  status public.donation_status not null default 'offered',
  recipient_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index donation_offers_user_created_idx on public.donation_offers(user_id, created_at desc);

-- Requests from verified food-rescue organizations for a retailer/household donation offer.
create table public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.donation_offers(id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 300),
  status text not null default 'requested' check (status in ('requested','accepted','declined','collected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, offer_id)
);
create index donation_requests_org_created_idx on public.donation_requests(organization_id, created_at desc);

create table public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type public.credit_entry_type not null,
  amount integer not null check (amount > 0),
  source_event_id uuid,
  reason text not null,
  status text not null default 'posted' check (status in ('pending','posted','reversed')),
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);
create unique index credit_ledger_source_once_idx on public.credit_ledger(user_id, source_event_id, entry_type) where source_event_id is not null;

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 120),
  cost_credits integer not null check (cost_credits > 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  cost_credits integer not null check (cost_credits > 0),
  status text not null default 'recorded' check (status in ('recorded','fulfilled','cancelled')),
  created_at timestamptz not null default now()
);

create table public.product_data_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text,
  product_name text not null check (char_length(product_name) between 1 and 120),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  credits_awarded integer not null default 0 check (credits_awarded >= 0),
  created_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Updated timestamp helper
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_profile before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger touch_batch before update on public.inventory_batches for each row execute procedure public.touch_updated_at();
create trigger touch_donation before update on public.donation_offers for each row execute procedure public.touch_updated_at();

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

-- Helper used by admin-only RLS policies. The function runs with its owner's privileges.
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin');
$$;
grant execute on function public.is_current_user_admin() to authenticated;

-- Administrative functions: admin role must be assigned manually by a trusted operator.
create or replace function public.admin_list_pending_accounts()
returns table(id uuid, full_name text, account_type public.account_type, created_at timestamptz, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin') then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return query
    select p.id, p.full_name, p.account_type, p.created_at, u.email::text
    from public.profiles p join auth.users u on u.id = p.id
    where p.account_type in ('retailer','organization') and p.is_verified = false
    order by p.created_at asc;
end;
$$;

create or replace function public.admin_set_user_verification(p_user_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin') then
    raise exception 'ADMIN_REQUIRED';
  end if;
  update public.profiles
    set is_verified = p_verified, updated_at = now()
    where id = p_user_id and account_type in ('retailer','organization');
  if not found then raise exception 'ACCOUNT_NOT_FOUND_OR_NOT_ELIGIBLE'; end if;
end;
$$;

grant execute on function public.admin_list_pending_accounts() to authenticated;
grant execute on function public.admin_set_user_verification(uuid, boolean) to authenticated;

-- RLS: users can only access their own records. Privileged donation verification is intentionally not exposed to ordinary users.
alter table public.profiles enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.pantry_products enable row level security;
alter table public.inventory_events enable row level security;
alter table public.donation_offers enable row level security;
alter table public.donation_requests enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.product_data_contributions enable row level security;

create policy "profile select own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "inventory own select" on public.inventory_batches for select to authenticated using (user_id = (select auth.uid()));
create policy "inventory own insert" on public.inventory_batches for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);
create policy "inventory own update" on public.inventory_batches for update to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
) with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified))));
create policy "inventory own delete" on public.inventory_batches for delete to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);
create policy "owners manage own pantry products" on public.pantry_products for all to authenticated using (
  owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'retailer' and p.is_verified = true)
) with check (
  owner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'retailer' and p.is_verified = true)
);
create policy "admins read all pantry products" on public.pantry_products for select to authenticated using ((select public.is_current_user_admin()));
create policy "public read active pantry products" on public.pantry_products for select to anon, authenticated using (active = true);
create policy "events own select" on public.inventory_events for select to authenticated using (user_id = (select auth.uid()));
create policy "donations own select" on public.donation_offers for select to authenticated using (user_id = (select auth.uid()));
create policy "admins read all donation offers" on public.donation_offers for select to authenticated using ((select public.is_current_user_admin()));
create policy "verified organizations can view offered donations" on public.donation_offers for select to authenticated using (
  status = 'offered' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'organization' and p.is_verified = true)
);
create policy "organizations select own requests" on public.donation_requests for select to authenticated using (organization_id = (select auth.uid()));
create policy "admins read all donation requests" on public.donation_requests for select to authenticated using ((select public.is_current_user_admin()));
create policy "donors select requests for own offers" on public.donation_requests for select to authenticated using (
  exists (select 1 from public.donation_offers d where d.id = offer_id and d.user_id = (select auth.uid()))
);
create policy "verified organizations request offered donations" on public.donation_requests for insert to authenticated with check (
  organization_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'organization' and p.is_verified = true)
  and exists (select 1 from public.donation_offers d where d.id = offer_id and d.status = 'offered')
);
create policy "donations own insert" on public.donation_offers for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.account_type = 'household' or (p.account_type = 'retailer' and p.is_verified)))
);
create policy "credit account own select" on public.credit_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy "ledger own select" on public.credit_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy "rewards visible when active" on public.rewards for select to authenticated using (active = true);
create policy "redemptions own select" on public.reward_redemptions for select to authenticated using (user_id = (select auth.uid()));
create policy "product contributions own select" on public.product_data_contributions for select to authenticated using (user_id = (select auth.uid()));
create policy "product contributions own insert" on public.product_data_contributions for insert to authenticated with check (user_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.inventory_batches to authenticated;
grant select, insert, update, delete on public.pantry_products to authenticated;
grant select on public.pantry_products to anon;
grant select on public.inventory_events, public.credit_accounts, public.credit_ledger, public.reward_redemptions to authenticated;
grant select, insert on public.donation_offers to authenticated;
grant select, insert on public.donation_requests to authenticated;
grant select on public.rewards to authenticated;
grant select, insert on public.product_data_contributions to authenticated;
grant execute on function public.record_inventory_event(uuid, public.inventory_event_type, numeric, text) to authenticated;
grant execute on function public.create_donation_offer(uuid, numeric, text) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;

insert into public.rewards(name,cost_credits,description,active)
values
 ('Community thank-you badge', 25, 'A demo recognition reward for positive food-rescue actions.', true),
 ('Partner coupon placeholder', 100, 'Placeholder only. A real partner must define and fulfill this benefit.', true)
on conflict do nothing;
