-- Add location column to meal_plans table to distinguish between Shore and Jackson
ALTER TABLE public.meal_plans 
ADD COLUMN location text NOT NULL DEFAULT 'Jackson';

-- Update existing meal plans to be Jackson location
UPDATE public.meal_plans SET location = 'Jackson' WHERE location IS NULL;