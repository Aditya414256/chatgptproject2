-- Install on a fresh project. This migration runs transactionally.
create table public.fm_profiles(id uuid primary key references auth.users on delete cascade,name text not null,phone text not null,role text not null check(role in ('customer','store_owner')));
create function public.fm_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.fm_profiles values(new.id,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.raw_user_meta_data->>'phone',''),coalesce(new.raw_user_meta_data->>'role','customer'));return new;end $$;
create trigger fm_user_created after insert on auth.users for each row execute function public.fm_signup();
create table public.fm_shops(id uuid primary key default gen_random_uuid(),owner uuid not null unique references public.fm_profiles,name text not null,address text not null,pins text[] not null default '{}',lat float8 check(lat between -90 and 90),lng float8 check(lng between -180 and 180),open boolean not null default false,stock jsonb not null default '{}',price jsonb not null default '{}');
create table public.fm_medicines(id text primary key,name text not null,rx boolean not null);
create table public.fm_orders(id uuid primary key,customer uuid not null references public.fm_profiles,shop uuid not null references public.fm_shops,created timestamptz not null default now(),doc jsonb not null);
create index fm_customer on public.fm_orders(customer,created desc);
create index fm_store on public.fm_orders(shop,created desc);
alter table public.fm_profiles enable row level security;
alter table public.fm_shops enable row level security;
alter table public.fm_medicines enable row level security;
alter table public.fm_orders enable row level security;
revoke all on public.fm_profiles,public.fm_shops,public.fm_medicines,public.fm_orders from anon,authenticated;
grant select on public.fm_profiles,public.fm_shops,public.fm_medicines,public.fm_orders to authenticated;
grant insert,update on public.fm_shops to authenticated;
create policy self on public.fm_profiles for select to authenticated using(id=auth.uid());
create policy catalog on public.fm_medicines for select to authenticated using(true);
create policy browse on public.fm_shops for select to authenticated using(true);
create policy manage on public.fm_shops for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid() and exists(select from public.fm_profiles where id=auth.uid() and role='store_owner'));
create policy participants on public.fm_orders for select to authenticated using(customer=auth.uid() or exists(select from public.fm_shops s where s.id=shop and s.owner=auth.uid()));
create function public.fm_nearby(ulat float8,ulng float8) returns table(id uuid,km float8) language sql stable security invoker set search_path=public as $$
select s.id, 12742*asin(sqrt(least(1,power(sin(radians(s.lat-ulat)/2),2)+cos(radians(ulat))*cos(radians(s.lat))*power(sin(radians(s.lng-ulng)/2),2)))) from fm_shops s order by 2 $$;
create function public.fm_place(shop_id uuid,basket jsonb,mode text,destination text,postcode text,file_path text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p fm_profiles; s fm_shops; m fm_medicines; item record; qty int; price numeric; total numeric:=0; lines jsonb:='[]'; need_rx boolean:=false; oid uuid:=gen_random_uuid(); stamp bigint:=(extract(epoch from now())*1000)::bigint; doc jsonb;
begin
 select * into strict p from fm_profiles where id=auth.uid() and role='customer';
 select * into strict s from fm_shops where id=shop_id and open for update;
 if mode is null or mode not in ('pickup','delivery') or basket is null or jsonb_typeof(basket)<>'object' or basket='{}'::jsonb then raise exception 'Invalid basket';end if;
 if mode='delivery' and (coalesce(trim(destination),'')='' or not coalesce(postcode=any(s.pins),false)) then raise exception 'Check delivery details';end if;
 for item in select * from jsonb_each_text(basket) loop
  qty:=item.value::int; select * into strict m from fm_medicines where id=item.key;
  price:=(s.price->>m.id)::numeric;
  if qty<1 or qty>coalesce((s.stock->>m.id)::int,0) or price is null or price<=0 then raise exception 'Stock or price unavailable';end if;
  total:=total+price*qty;need_rx:=need_rx or m.rx;
  lines:=lines||jsonb_build_array(jsonb_build_object('id',m.id,'name',m.name,'rx',m.rx,'qty',qty,'price',price));
  s.stock:=jsonb_set(s.stock,array[m.id],to_jsonb((s.stock->>m.id)::int-qty));
 end loop;
 if mode='delivery' and need_rx and not exists(select from storage.objects where bucket_id='prescriptions' and name=file_path and (storage.foldername(name))[1]=p.id::text) then raise exception 'Prescription required';end if;
 doc:=jsonb_build_object('id',oid,'customer',p.id,'person',p.name,'phone',p.phone,'shop',s.id,'method',mode,'address',destination,'pin',postcode,'lines',lines,'total',total,'status','pending','code',(1000+floor(random()*9000)::int)::text,'reason','','rx',case when mode='delivery' and need_rx then file_path else '' end,'created',stamp,'expires',stamp+coalesce(nullif(current_setting('app.order_expiry_ms',true),'')::int,600000));
 update fm_shops set stock=s.stock where id=s.id;insert into fm_orders(id,customer,shop,doc) values(oid,p.id,s.id,doc);return doc;
end $$;
create function public.fm_change(order_id uuid,target text,detail text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o fm_orders; s fm_shops; line jsonb; old text; isowner boolean;
begin select * into strict o from fm_orders where id=order_id for update;select * into strict s from fm_shops where id=o.shop for update;
 old:=o.doc->>'status';isowner:=s.owner=auth.uid();
 if not coalesce((old='pending' and ((isowner and target in ('accepted','rejected')) or (auth.uid()=o.customer and target='cancelled') or (auth.uid() is null and target='expired' and (o.doc->>'expires')::bigint<=extract(epoch from now())*1000))) or (old='accepted' and isowner and target in ('cancelled',case o.doc->>'method' when 'pickup' then 'ready' else 'out_for_delivery' end)) or (old in ('ready','out_for_delivery') and isowner and target in ('completed','not_collected')),false) then raise exception 'Invalid order transition';end if;
 if target='completed' and detail is distinct from (o.doc->>'code') or target='rejected' and coalesce(trim(detail),'')='' then raise exception 'Code or rejection reason required';end if;
 if target in ('expired','cancelled','rejected') then for line in select value from jsonb_array_elements(o.doc->'lines') loop s.stock:=jsonb_set(s.stock,array[line->>'id'],to_jsonb(coalesce((s.stock->>(line->>'id'))::int,0)+(line->>'qty')::int));end loop;update fm_shops set stock=s.stock where id=s.id;end if;
 update fm_orders set doc=o.doc||jsonb_build_object('status',target,'reason',case when target='rejected' then detail else '' end) where id=o.id;
end $$;
revoke all on function public.fm_place(uuid,jsonb,text,text,text,text), public.fm_change(uuid,text,text) from public,anon;
grant execute on function public.fm_place(uuid,jsonb,text,text,text,text), public.fm_change(uuid,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('prescriptions','prescriptions',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict do nothing;
create policy fm_upload on storage.objects for insert to authenticated with check(bucket_id='prescriptions' and (storage.foldername(name))[1]=auth.uid()::text);
create policy fm_view on storage.objects for select to authenticated using(bucket_id='prescriptions' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select from public.fm_orders o where o.doc->>'rx'=name)));
alter publication supabase_realtime add table public.fm_orders;
create extension if not exists pg_cron;
select cron.schedule('fm-expiry','* * * * *',$job$select public.fm_change(id,'expired','') from public.fm_orders where doc->>'status'='pending' and (doc->>'expires')::bigint<=extract(epoch from now())*1000$job$);
insert into public.fm_medicines values ('m1','Paracetamol',false),('m2','Cetirizine',false),('m3','Oral rehydration salts',false),('m4','Amoxicillin',true),('m5','Vitamin C',false),('m6','Calamine',false),('m7','Metformin',true),('m8','Amlodipine',true),('m9','Saline nasal spray',false),('m10','Omeprazole',true),('m11','Clotrimazole',false),('m12','Vitamin D3',false),('m13','Zinc',false),('m14','Azithromycin',true),('m15','Povidone iodine',false),('m16','Carboxymethylcellulose',false);
