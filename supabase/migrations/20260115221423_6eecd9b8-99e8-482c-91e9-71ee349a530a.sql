-- Create cleanup_jobs table to track global cleanup progress
CREATE TABLE public.cleanup_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  phase TEXT DEFAULT 'sync',
  total_to_sync INTEGER DEFAULT 0,
  synced_count INTEGER DEFAULT 0,
  bounces_found INTEGER DEFAULT 0,
  emails_cleared INTEGER DEFAULT 0,
  contacts_deleted INTEGER DEFAULT 0,
  crm_reset INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  last_processed_id TEXT,
  last_error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth in this project)
CREATE POLICY "Allow all operations on cleanup_jobs"
ON public.cleanup_jobs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_cleanup_jobs_updated_at
BEFORE UPDATE ON public.cleanup_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();