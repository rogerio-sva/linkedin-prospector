-- Create CRM stages table for Kanban
CREATE TABLE public.crm_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on crm_stages" 
ON public.crm_stages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert default stages
INSERT INTO public.crm_stages (name, color, position) VALUES
  ('Novo Lead', '#64748b', 0),
  ('Prospecção', '#3b82f6', 1),
  ('Contato Inicial', '#8b5cf6', 2),
  ('Em Negociação', '#f59e0b', 3),
  ('Proposta Enviada', '#06b6d4', 4),
  ('Fechado Ganho', '#22c55e', 5),
  ('Fechado Perdido', '#ef4444', 6);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on team_members" 
ON public.team_members 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create contact_activities table for activity history
CREATE TABLE public.contact_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  performed_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on contact_activities" 
ON public.contact_activities 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_created_at ON public.contact_activities(created_at DESC);

-- Add new columns to contacts table for CRM
ALTER TABLE public.contacts 
ADD COLUMN crm_stage TEXT DEFAULT 'Novo Lead',
ADD COLUMN assigned_to TEXT,
ADD COLUMN linkedin_contacted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN notes TEXT;