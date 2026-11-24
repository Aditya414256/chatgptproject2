-- Applies to the existing private bucket.
drop policy if exists findmedicine_upload on storage.objects;
create policy findmedicine_upload on storage.objects for insert to authenticated
with check (bucket_id='prescriptions' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles where id=auth.uid() and role='customer'));
drop policy if exists findmedicine_read on storage.objects;
create policy findmedicine_read on storage.objects for select to authenticated using
(bucket_id='prescriptions' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.orders o join public.stores s on s.id=o.store_id where o.prescription_path=storage.objects.name and s.owner_id=auth.uid())));
