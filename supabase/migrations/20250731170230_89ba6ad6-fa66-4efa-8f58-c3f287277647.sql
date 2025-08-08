-- Add isStaple column to shopping_list table to mark items added from staples
ALTER TABLE public.shopping_list 
ADD COLUMN is_staple BOOLEAN DEFAULT false;