-- Make customer-documents bucket public so license images can be viewed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'customer-documents';