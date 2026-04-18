-- RUN THESE COMMANDS IN YOUR SUPABASE SQL EDITOR TO ENABLE GITHUB PAGES ACCESS

-- 1. Enable Storage for the 'user-files' bucket
insert into storage.buckets (id, name, public) 
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- 2. Allow users to SELECT their own files
create policy "Users can view their own files" 
on storage.objects for select 
to authenticated 
using ( bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 3. Allow users to INSERT (upload) their own files
create policy "Users can upload their own files" 
on storage.objects for insert 
to authenticated 
with check ( bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 4. Allow users to UPDATE their own files
create policy "Users can update their own files" 
on storage.objects for update 
to authenticated 
using ( bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 5. Allow users to DELETE their own files
create policy "Users can delete their own files" 
on storage.objects for delete 
to authenticated 
using ( bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text );
