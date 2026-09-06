begin;

insert into public.workspaces (id, name, timezone) values
  ('11111111-1111-4111-8111-111111111111', 'Styled For Less', 'America/Chicago');

insert into public.destinations (id, workspace_id, name, platform, posting_identity) values
  ('20000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Styled For Less Facebook Page', 'facebook_page', 'Styled For Less'),
  ('20000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Instagram Feed', 'instagram_feed', 'Styled For Less'),
  ('20000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Instagram Reel', 'instagram_reel', 'Styled For Less'),
  ('20000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Personal Facebook Profile', 'facebook_personal', 'Elaine');

insert into public.products (id, workspace_id, name, brand, category, lifecycle_status, experience_level, tags, notes) values
  ('30000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Brown Swivel Chair', 'Hearth & Demo', 'Furniture', 'active', 'owned', array['chair', 'living room', 'brown'], 'Expected strongest Today candidate.'),
  ('30000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Decorative Box Set', 'Found House', 'Decor', 'active', 'owned', array['box', 'storage', 'shelf styling'], 'Strong fresh candidate.'),
  ('30000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Travertine Accent Table', 'Studio Sample', 'Furniture', 'active', 'used_at_home', array['table', 'travertine', 'neutral'], 'Recent winner that should be deprioritized.'),
  ('30000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Woven Vase', 'Market Sample', 'Decor', 'active', 'owned', array['vase', 'woven', 'coastal'], 'Prior winner that is currently out of stock.'),
  ('30000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Fall Wreath Collection', 'Seasonal Sample', 'Seasonal', 'active', 'seen_in_store', array['fall', 'wreath', 'front door'], 'Seasonal revival candidate.'),
  ('30000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Linen Table Lamp', 'Soft Light Co.', 'Lighting', 'active', 'online_only', array['lamp', 'linen', 'bedroom'], 'Requires new content.');

insert into public.listings (id, workspace_id, product_id, retailer, canonical_url, current_price, stock_status, is_primary, last_checked_at) values
  ('40000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', 'Demo Target', 'https://target.example/brown-swivel-chair', 249.99, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000002', 'Demo Walmart', 'https://walmart.example/decorative-box-set', 34.00, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000003', 'Demo Home Store', 'https://home.example/travertine-accent-table', 129.00, 'in_stock', true, now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000004', 'Demo Marketplace', 'https://market.example/woven-vase', 42.00, 'out_of_stock', true, now() - interval '3 days'),
  ('40000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000005', 'Demo Seasonal Shop', 'https://seasonal.example/fall-wreath', 54.99, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000006', 'Demo Lighting', 'https://lighting.example/linen-table-lamp', 78.00, 'limited', true, now() - interval '4 days');

insert into public.affiliate_links (id, workspace_id, listing_id, network, url, is_active) values
  ('50000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', 'later_creator', 'https://affiliate.example/brown-swivel-chair', true),
  ('50000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000002', 'shoppe_dwell', 'https://affiliate.example/decorative-box-set', true),
  ('50000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000003', 'demo_network', 'https://affiliate.example/travertine-table', true),
  ('50000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000004', 'demo_network', 'https://affiliate.example/woven-vase', true),
  ('50000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000005', 'later_creator', 'https://affiliate.example/fall-wreath', true);

insert into public.assets (id, workspace_id, title, asset_type, source, captured_at) values
  ('60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Chair in living room', 'photo', 'home', now() - interval '3 days'),
  ('60000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Chair original post photo', 'photo', 'home', now() - interval '60 days'),
  ('60000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Box set shelf styling', 'photo', 'home', now() - interval '7 days'),
  ('60000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Table detail photo', 'photo', 'home', now() - interval '8 days'),
  ('60000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Woven vase vignette', 'photo', 'home', now() - interval '90 days'),
  ('60000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Fall wreath roundup graphic', 'canva_graphic', 'canva', now() - interval '10 days');

insert into public.asset_products (asset_id, product_id, role) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'primary'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'visible'),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'primary'),
  ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'primary'),
  ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', 'primary'),
  ('60000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000005', 'primary');

insert into public.posts (id, workspace_id, destination_id, published_at, caption, angle, performance_label) values
  ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000001', now() - interval '46 days', 'This chair is finally back.', 'living room refresh', 'winner'),
  ('70000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002', now() - interval '4 days', 'The table that works anywhere.', 'small-space styling', 'winner'),
  ('70000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000001', now() - interval '70 days', 'Texture for an empty corner.', 'easy shelf styling', 'winner'),
  ('70000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002', now() - interval '60 days', 'A simple front-door refresh.', 'fall entry', 'normal');

insert into public.post_products (post_id, product_id) values
  ('70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003'),
  ('70000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004'),
  ('70000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000005');

insert into public.post_assets (post_id, asset_id, position) values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 0),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 0),
  ('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000005', 0);

insert into public.post_metrics (post_id, captured_at, reach, views, clicks, sales, commission) values
  ('70000000-0000-4000-8000-000000000001', now() - interval '44 days', 18500, 22000, 740, 18, 126.40),
  ('70000000-0000-4000-8000-000000000002', now() - interval '2 days', 12300, 14800, 490, 9, 72.00);

insert into public.radar_events (id, workspace_id, product_id, listing_id, event_type, source, happened_at, expires_at, metadata) values
  ('80000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'restock', 'manual', now() - interval '1 day', now() + interval '13 days', '{"note":"Manually confirmed back in stock"}'),
  ('80000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', 'seasonal', 'manual', now() - interval '2 days', now() + interval '45 days', '{"season":"fall"}');

commit;
