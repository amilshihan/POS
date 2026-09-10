-- Product groups become a tree (e.g. Products / Oil / Castrol) instead of a flat list.

alter table categories add column parent_id uuid references categories(id) on delete set null;

create index categories_parent_id_idx on categories(parent_id);

-- A group name only needs to be unique among its siblings, not globally,
-- now that "Oil" can exist under both "Products" and, say, "Discontinued".
alter table categories drop constraint if exists categories_name_key;
create unique index categories_parent_name_idx on categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
