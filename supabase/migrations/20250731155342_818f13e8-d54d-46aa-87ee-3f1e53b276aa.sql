-- Remove problematic check constraints that are causing issues
ALTER TABLE pantry_items DROP CONSTRAINT IF EXISTS pantry_items_location_check;
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_week_type_check;