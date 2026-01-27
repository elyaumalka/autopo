-- Allow public read access to customer-documents bucket
CREATE POLICY "Public can view customer documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-documents');