# Supabase Dashboard Setup (For GitHub Pages Deployment)

If you are hosting your app on **GitHub Pages**, the backend proxy (Node.js) cannot run. The app will automatically fall back to direct Supabase calls. 

For this to work, you **MUST** run the following SQL commands in your Supabase SQL Editor to set up the correct Row Level Security (RLS) policies.

## 1. Enable RLS on the Bucket
Ensure your `user-files` bucket has RLS enabled (it is by default).

## 2. Set up RLS Policies
Copy and paste this SQL into the **SQL Editor** in your Supabase Dashboard and click **Run**:

```sql
-- 1. Allow authenticated users to upload files to their own folder
CREATE POLICY "Allow users to upload files to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to view/list files in their own folder
CREATE POLICY "Allow users to view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to delete files in their own folder
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to update files in their own folder
CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE
TO authenticated
WITH CHECK (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3. Verify Public Access
If you want to allow file previews without complex signing on static hosts:
1. Go to **Storage** -> **Buckets**.
2. Find `user-files`.
3. Click the three dots (...) and select **Make Public**. (I have already run a script to do this for you, but double-check in the dashboard).

---

After running these SQL commands, your app will work perfectly even when hosted on GitHub Pages!
