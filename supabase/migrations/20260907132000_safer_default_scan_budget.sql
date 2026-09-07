alter table public.radars alter column max_results_per_scan set default 25;
update public.radars set max_results_per_scan=least(max_results_per_scan,25);
