-- Create table to persist search runs
CREATE TABLE public.search_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  dataset_id TEXT,
  status TEXT DEFAULT 'RUNNING',
  filters JSONB,
  fetch_count INTEGER,
  output_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.search_runs ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (personal tool, no auth)
CREATE POLICY "Allow all operations on search_runs" 
ON public.search_runs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_search_runs_status ON public.search_runs(status);
CREATE INDEX idx_search_runs_created_at ON public.search_runs(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_search_runs_updated_at
BEFORE UPDATE ON public.search_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();