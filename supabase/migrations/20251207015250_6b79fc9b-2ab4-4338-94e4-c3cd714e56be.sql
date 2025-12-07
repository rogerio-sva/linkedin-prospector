-- Create tags table
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create contact_tags junction table
CREATE TABLE public.contact_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags
CREATE POLICY "Allow all operations on tags" ON public.tags FOR ALL USING (true) WITH CHECK (true);

-- Create policies for contact_tags
CREATE POLICY "Allow all operations on contact_tags" ON public.contact_tags FOR ALL USING (true) WITH CHECK (true);

-- Insert default tags
INSERT INTO public.tags (name, color) VALUES 
  ('Hot', '#ef4444'),
  ('Warm', '#f97316'),
  ('Cold', '#3b82f6'),
  ('Prospect', '#8b5cf6'),
  ('Cliente', '#22c55e'),
  ('Não Interessado', '#6b7280');