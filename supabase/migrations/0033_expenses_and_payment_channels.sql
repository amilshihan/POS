-- Daily expenses (bill payments, charity, food, etc.), paid by cash or
-- online transfer, so they can be weighed against revenue in the new
-- Finance overview page.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'online')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;
create policy "expenses_select" on expenses for select using (auth.uid() is not null);
create policy "expenses_write_admin" on expenses for insert with check (is_admin(auth.uid()));
create policy "expenses_update_admin" on expenses for update using (is_admin(auth.uid()));
create policy "expenses_delete_admin" on expenses for delete using (is_admin(auth.uid()));

-- Let a sale or a customer payment record be received by card or online
-- transfer, not just cash/credit/cheque/mixed, so revenue can be reported
-- by the channel it actually came in through.
alter type payment_method add value if not exists 'card';
alter type payment_method add value if not exists 'online';
