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
  ('30000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Linen Table Lamp', 'Soft Light Co.', 'Lighting', 'active', 'online_only', array['lamp', 'linen', 'bedroom'], 'Requires new content.'),
  ('30000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'McGee Corinne Boxes', 'McGee & Co.', 'Decor', 'active', 'owned', array['corinne', 'box', 'comparison'], 'Reference product for the Corinne box comparison.'),
  ('30000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Corinne-Style Box Set', 'Demo Amazon Find', 'Decor', 'active', 'owned', array['corinne', 'dupe', 'box'], 'Affordable comparison product.'),
  ('30000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Target Taper Candle Set', 'Demo Target Find', 'Decor', 'active', 'seen_in_store', array['candle', 'taper', 'sale'], 'Sale-led content opportunity.'),
  ('30000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'At Home Antonia Vase', 'Demo At Home Find', 'Decor', 'active', 'owned', array['antonia', 'vase', 'comparison'], 'Published comparison fixture.'),
  ('30000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Styled Target Table', 'Demo Target Find', 'Furniture', 'active', 'used_at_home', array['table', 'styled at home'], 'Published styled-at-home fixture.'),
  ('30000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'At Home Rice-Stem Vase', 'Demo At Home Find', 'Decor', 'active', 'seen_in_store', array['vase', 'rice stem', 'styling'], 'Needs new styling assets.'),
  ('30000000-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'Home Depot Hallway Light', 'Demo Home Depot Find', 'Lighting', 'active', 'owned', array['hallway', 'light', 'styled at home'], 'Idea captured before photography.');

insert into public.listings (id, workspace_id, product_id, retailer, canonical_url, current_price, stock_status, is_primary, last_checked_at) values
  ('40000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', 'Demo Walmart', 'https://walmart.example/brown-swivel-chair', 249.99, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000002', 'Demo Walmart', 'https://walmart.example/decorative-box-set', 34.00, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000003', 'Demo At Home', 'https://athome.example/travertine-accent-table', 129.00, 'in_stock', true, now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000004', 'Demo Marketplace', 'https://market.example/woven-vase', 42.00, 'out_of_stock', true, now() - interval '3 days'),
  ('40000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000005', 'Demo Seasonal Shop', 'https://seasonal.example/fall-wreath', 54.99, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000006', 'Demo Lighting', 'https://lighting.example/linen-table-lamp', 78.00, 'limited', true, now() - interval '4 days'),
  ('40000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000008', 'Demo Amazon', 'https://amazon.example/corinne-style-box-set', 38.99, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000009', 'Demo Target', 'https://target.example/taper-candle-set', 18.00, 'in_stock', true, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000010', 'Demo At Home', 'https://athome.example/antonia-vase', 29.99, 'in_stock', true, now() - interval '3 days'),
  ('40000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000011', 'Demo Target', 'https://target.example/styled-table', 119.99, 'in_stock', true, now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000012', 'Demo At Home', 'https://athome.example/rice-stem-vase', 24.99, 'unknown', true, now() - interval '6 days'),
  ('40000000-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000013', 'Demo Home Depot', 'https://homedepot.example/hallway-light', 89.00, 'in_stock', true, now() - interval '5 days');

insert into public.affiliate_links (id, workspace_id, listing_id, network, url, is_active) values
  ('50000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', 'later_creator', 'https://affiliate.example/brown-swivel-chair', true),
  ('50000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000002', 'shoppe_dwell', 'https://affiliate.example/decorative-box-set', true),
  ('50000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000003', 'demo_network', 'https://affiliate.example/travertine-table', true),
  ('50000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000004', 'demo_network', 'https://affiliate.example/woven-vase', true),
  ('50000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000005', 'later_creator', 'https://affiliate.example/fall-wreath', true),
  ('50000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000008', 'amazon', 'https://affiliate.example/corinne-style-box-set', true),
  ('50000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000009', 'later_creator', 'https://affiliate.example/taper-candle-set', true),
  ('50000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000010', 'shoppe_dwell', 'https://affiliate.example/antonia-vase', true),
  ('50000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000011', 'later_creator', 'https://affiliate.example/styled-table', true);

insert into public.assets (id, workspace_id, title, asset_type, source, captured_at) values
  ('60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Chair in living room', 'photo', 'home', now() - interval '3 days'),
  ('60000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Chair original post photo', 'photo', 'home', now() - interval '60 days'),
  ('60000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Box set shelf styling', 'photo', 'home', now() - interval '7 days'),
  ('60000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Table detail photo', 'photo', 'home', now() - interval '8 days'),
  ('60000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Woven vase vignette', 'photo', 'home', now() - interval '90 days'),
  ('60000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Fall wreath roundup graphic', 'canva_graphic', 'canva', now() - interval '10 days'),
  ('60000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Corinne styled image one', 'photo', 'home', now() - interval '5 days'),
  ('60000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Corinne styled image two', 'photo', 'home', now() - interval '5 days'),
  ('60000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Corinne comparison image', 'canva_graphic', 'canva', now() - interval '4 days'),
  ('60000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Target taper candle sale graphic', 'canva_graphic', 'canva', now() - interval '1 day'),
  ('60000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Finished coffee bar photo', 'photo', 'home', now() - interval '8 days'),
  ('60000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'Antonia comparison carousel', 'canva_graphic', 'canva', now() - interval '4 days'),
  ('60000000-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'Styled Target table photo', 'photo', 'home', now() - interval '3 days');

insert into public.asset_products (asset_id, product_id, role) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'primary'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'visible'),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'primary'),
  ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'primary'),
  ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', 'primary'),
  ('60000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000005', 'primary'),
  ('60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000007', 'visible'),
  ('60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000008', 'visible'),
  ('60000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000007', 'visible'),
  ('60000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000008', 'visible'),
  ('60000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000007', 'comparison'),
  ('60000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000008', 'comparison'),
  ('60000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000009', 'primary'),
  ('60000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000010', 'primary'),
  ('60000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000011', 'primary');

insert into public.content_opportunities (
  id, workspace_id, title, status, content_type, media_format, notes,
  next_action, estimated_minutes_remaining
) values
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Home Depot hallway light', 'needs_assets', 'styled_at_home', 'single_image', 'The idea is saved; photography has not happened yet.', 'Take hallway pictures', 30),
  ('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Coffee bar', 'ready', 'lifestyle_shop_the_look', 'carousel', 'Completely finished and published.', null, 5),
  ('90000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Corinne box dupes', 'needs_caption', 'comparison', 'carousel', 'Pictures and affiliate link are ready.', 'Write the caption', 10),
  ('90000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Five fall wreaths under $35', 'needs_caption', 'collection_roundup', 'canva_graphic', 'Roundup graphic and links are ready.', 'Write the caption', 10),
  ('90000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Target taper candle sale', 'needs_caption', 'sale_restock', 'canva_graphic', 'Sale graphic is prepared.', 'Write the sale caption', 10),
  ('90000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'At Home Antonia comparison', 'ready', 'comparison', 'carousel', 'Published to more than one destination as one content idea.', null, 5),
  ('90000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Styled Target table', 'ready', 'styled_at_home', 'single_image', 'Styled-at-home publication fixture.', null, 5),
  ('90000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'At Home rice-stem vase styling', 'needs_assets', 'styled_at_home', 'single_image', 'The product is known but the styling assets are not ready.', 'Style and photograph the vase', 30),
  ('90000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Walmart swivel chair', 'ready', 'sale_restock', 'single_image', 'Previously published winner with a current restock reason.', 'Refresh the caption', 10),
  ('90000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'At Home travertine table', 'ready', 'styled_at_home', 'single_image', 'Recently published winner.', null, 5);

insert into public.content_opportunity_products (opportunity_id, product_id, role) values
  ('90000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000013', 'primary'),
  ('90000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000007', 'primary'),
  ('90000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000008', 'comparison'),
  ('90000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000005', 'primary'),
  ('90000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000009', 'primary'),
  ('90000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000010', 'primary'),
  ('90000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000011', 'primary'),
  ('90000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000012', 'primary'),
  ('90000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000001', 'primary'),
  ('90000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000003', 'primary');

insert into public.content_opportunity_assets (opportunity_id, asset_id, role) values
  ('90000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000011', 'primary'),
  ('90000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000007', 'primary'),
  ('90000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000008', 'supporting'),
  ('90000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000009', 'comparison'),
  ('90000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000006', 'primary'),
  ('90000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000010', 'primary'),
  ('90000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000012', 'primary'),
  ('90000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000013', 'primary'),
  ('90000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000001', 'primary'),
  ('90000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000004', 'primary');

insert into public.posts (id, workspace_id, content_opportunity_id, destination_id, published_at, caption, angle, performance_label) values
  ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', now() - interval '46 days', 'This chair is finally back.', 'living room refresh', 'winner'),
  ('70000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', now() - interval '4 days', 'The table that works anywhere.', 'small-space styling', 'winner'),
  ('70000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', null, '20000000-0000-4000-8000-000000000001', now() - interval '70 days', 'Texture for an empty corner.', 'easy shelf styling', 'winner'),
  ('70000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', null, '20000000-0000-4000-8000-000000000002', now() - interval '60 days', 'A simple front-door refresh.', 'fall entry', 'normal'),
  ('70000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', now() - interval '7 days', 'The coffee bar is finally finished.', 'finished space', 'normal'),
  ('70000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', now() - interval '3 days', 'The Antonia look for less.', 'comparison', 'winner'),
  ('70000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', now() - interval '3 days', 'The Antonia look for less.', 'comparison', 'winner'),
  ('70000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', now() - interval '2 days', 'A simple Target table styling.', 'styled at home', 'normal');

insert into public.post_products (post_id, product_id) values
  ('70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003'),
  ('70000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004'),
  ('70000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000005'),
  ('70000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000010'),
  ('70000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000010'),
  ('70000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000011');

insert into public.post_assets (post_id, asset_id, position) values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 0),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 0),
  ('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000005', 0),
  ('70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000011', 0),
  ('70000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000012', 0),
  ('70000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000012', 0),
  ('70000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000013', 0);

insert into public.post_metrics (post_id, captured_at, reach, views, clicks, sales, commission) values
  ('70000000-0000-4000-8000-000000000001', now() - interval '44 days', 18500, 22000, 740, 18, 126.40),
  ('70000000-0000-4000-8000-000000000002', now() - interval '2 days', 12300, 14800, 490, 9, 72.00),
  ('70000000-0000-4000-8000-000000000006', now() - interval '1 day', 16400, 19100, 620, 14, 102.00);

insert into public.radar_events (id, workspace_id, product_id, listing_id, event_type, source, happened_at, expires_at, metadata) values
  ('80000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'restock', 'manual', now() - interval '1 day', now() + interval '13 days', '{"note":"Manually confirmed back in stock"}'),
  ('80000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', 'seasonal', 'manual', now() - interval '2 days', now() + interval '45 days', '{"season":"fall"}'),
  ('80000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000009', 'sale', 'manual', now() - interval '1 day', now() + interval '5 days', '{"discount":"40%"}');

update public.content_opportunities
set status = 'revival_candidate',
    next_action = 'Refresh the caption',
    estimated_minutes_remaining = 10
where id = '90000000-0000-4000-8000-000000000009';

commit;
