-- Create bases table (named contact lists)
CREATE TABLE public.bases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table linked to bases
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_id UUID NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  job_title TEXT,
  email TEXT,
  personal_email TEXT,
  mobile_number TEXT,
  company_phone TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  company_website TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  seniority_level TEXT,
  full_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(base_id, linkedin_url),
  UNIQUE(base_id, email)
);

-- Create index for faster lookups
CREATE INDEX idx_contacts_base_id ON public.contacts(base_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_linkedin ON public.contacts(linkedin_url);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bases_updated_at
BEFORE UPDATE ON public.bases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS for personal use (single user tool)
ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for personal tool (no auth required)
CREATE POLICY "Allow all operations on bases" ON public.bases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);