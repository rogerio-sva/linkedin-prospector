-- Create email_validations table for caching email validation results
CREATE TABLE public.email_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'deliverable', 'undeliverable', 'risky', 'unknown', 'pending'
  score INTEGER, -- 0-100
  reason TEXT,
  state TEXT, -- 'deliverable', 'undeliverable', 'risky', 'unknown' from Emailable
  free BOOLEAN DEFAULT false,
  disposable BOOLEAN DEFAULT false,
  accept_all BOOLEAN DEFAULT false,
  role BOOLEAN DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_validations ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on email_validations" 
ON public.email_validations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for fast email lookups
CREATE INDEX idx_email_validations_email ON public.email_validations(email);
CREATE INDEX idx_email_validations_status ON public.email_validations(status);