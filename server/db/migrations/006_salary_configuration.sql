-- Add salary configuration fields to salary_config table
ALTER TABLE salary_config 
  ADD COLUMN IF NOT EXISTS wage numeric(12,2), -- Monthly wage
  ADD COLUMN IF NOT EXISTS wage_type text DEFAULT 'FIXED', -- 'FIXED' for now
  ADD COLUMN IF NOT EXISTS component_config jsonb DEFAULT '{}', -- Configuration for each component
  ADD COLUMN IF NOT EXISTS pf_rate numeric(5,2) DEFAULT 12.00, -- PF rate percentage
  ADD COLUMN IF NOT EXISTS professional_tax numeric(10,2) DEFAULT 200.00; -- Professional tax amount

-- Update existing records: set wage = basic + sum of allowances if wage is null
UPDATE salary_config 
SET wage = COALESCE(
  basic + (
    SELECT COALESCE(SUM(value::numeric), 0)
    FROM jsonb_each_text(allowances)
  ),
  basic * 2 -- Fallback: assume wage is 2x basic if no allowances
)
WHERE wage IS NULL;

-- Set default component_config for existing records
-- Basic: 50% of wage
-- HRA: 50% of basic
-- Standard Allowance: Fixed 4167 (or calculate from existing allowances)
-- Performance Bonus: 8.33% of basic
-- LTA: 8.333% of basic
-- Fixed Allowance: Remaining amount
UPDATE salary_config
SET component_config = jsonb_build_object(
  'basic', jsonb_build_object(
    'type', 'PERCENTAGE_OF_WAGE',
    'value', 50.00
  ),
  'hra', jsonb_build_object(
    'type', 'PERCENTAGE_OF_BASIC',
    'value', 50.00
  ),
  'standardAllowance', jsonb_build_object(
    'type', 'FIXED_AMOUNT',
    'value', 4167.00
  ),
  'performanceBonus', jsonb_build_object(
    'type', 'PERCENTAGE_OF_BASIC',
    'value', 8.33
  ),
  'lta', jsonb_build_object(
    'type', 'PERCENTAGE_OF_BASIC',
    'value', 8.333
  ),
  'fixedAllowance', jsonb_build_object(
    'type', 'REMAINING_AMOUNT',
    'value', 0
  )
)
WHERE component_config = '{}'::jsonb OR component_config IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN salary_config.wage IS 'Monthly wage amount';
COMMENT ON COLUMN salary_config.wage_type IS 'Type of wage (FIXED, HOURLY, etc.)';
COMMENT ON COLUMN salary_config.component_config IS 'Configuration for salary components with computation type and value';
COMMENT ON COLUMN salary_config.pf_rate IS 'Provident Fund rate as percentage (e.g., 12.00 for 12%)';
COMMENT ON COLUMN salary_config.professional_tax IS 'Professional tax amount per month';

