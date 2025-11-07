-- Create templates table for storing GitHub template repositories
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  preview_image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on tags for filtering
CREATE INDEX idx_templates_tags ON public.templates USING GIN(tags);

-- Create index on created_at for sorting
CREATE INDEX idx_templates_created_at ON public.templates(created_at DESC);

-- Enable RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all templates
CREATE POLICY "Authenticated users can view templates"
ON public.templates
FOR SELECT
TO authenticated
USING (true);

-- Policy: All authenticated users can insert templates
CREATE POLICY "Authenticated users can add templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = submitted_by);

-- Policy: Only admins can update templates
CREATE POLICY "Admins can update templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Only admins can delete templates
CREATE POLICY "Admins can delete templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW
EXECUTE FUNCTION public.update_templates_updated_at();

