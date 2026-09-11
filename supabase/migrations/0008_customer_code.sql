-- Auto-generated, sequential customer codes like "AAH-000001".

create sequence customer_code_seq start 1;

alter table customers add column customer_code text unique;

-- Backfill existing customers in creation order.
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from customers
)
update customers c
set customer_code = 'AAH-' || lpad(ordered.rn::text, 6, '0')
from ordered
where c.id = ordered.id;

select setval('customer_code_seq', (select count(*) from customers));

alter table customers alter column customer_code set not null;

create function set_customer_code() returns trigger
  language plpgsql as $$
begin
  if new.customer_code is null then
    new.customer_code := 'AAH-' || lpad(nextval('customer_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_customer_code
  before insert on customers
  for each row execute function set_customer_code();
