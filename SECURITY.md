# Security notes

- Do not commit `.env.local`, access tokens, passwords, or Supabase service-role keys.
- All user-owned tables should remain protected by Row Level Security.
- Server actions must derive user identity from Supabase Auth, not form input.
- Keep product lookup on the server API route to control input, timeout, and caching.
- For a public launch, add abuse/rate limiting for auth, barcode lookup, donation offers and credit redemptions.
- Replace self-selected retailer/organization roles with admin-approved membership.
- Use a verified partner workflow before awarding donation credits or fulfilling rewards.
- Review the free-text waste deduction logic. A production system should use explicit reason categories, no safety penalties, user appeals, and auditable corrections.
- Database migrations should be reviewed and tested against a staging project before production.
