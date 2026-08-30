-- Corridor Freight — real pricing + plan descriptions
-- See ROADMAP.md §71/§72: Joseph's three price points, Fleet's
-- driver_limit corrected from 0009's 100-driver placeholder down to 30
-- (this product's actual target market), and Fleet's price corrected a
-- second time from §71's $380 to §72's $750 before this migration was
-- ever run — the numbers below are §72's final figures, §71's $380 was
-- never applied.
--
-- Updates existing rows by key, not a fresh insert — 0009 already
-- created these four plans; this only ever changes their price,
-- driver_limit, and (new) description/features columns.

alter table public.plans
  add column description text,
  add column features     text[] not null default '{}';

update public.plans set
  description = 'Try Corridor free while you get set up.',
  features = array[
    'Up to 3 drivers',
    'Unlimited loads and dispatch',
    'Driver portal with signature capture',
    'Email support'
  ]
  where key = 'trial';

update public.plans set
  monthly_price_cents = 8500,
  description = 'For small carriers running day-to-day dispatch.',
  features = array[
    'Up to 10 drivers',
    'Unlimited loads and dispatch',
    'Driver portal with signature capture',
    'Payment tracking',
    'Email support'
  ]
  where key = 'starter';

update public.plans set
  monthly_price_cents = 12500,
  description = 'For growing fleets that need more than one dispatcher.',
  features = array[
    'Up to 25 drivers',
    'Everything in Starter',
    'Team roles — dispatcher and admin',
    'Priority email support'
  ]
  where key = 'growth';

update public.plans set
  monthly_price_cents = 75000,
  driver_limit = 30,
  description = 'For established fleets running near full capacity.',
  features = array[
    'Up to 30 drivers',
    'Everything in Growth',
    'Dedicated onboarding',
    'Priority phone support'
  ]
  where key = 'fleet';
