-- Reel/video describes the medium, not the editorial idea. Preserve that
-- medium for existing captures while making their editorial type optional.
update public.content_opportunities
set media_format = coalesce(media_format, 'reel_video'::public.content_media_format)
where content_type = 'reel_video'::public.content_opportunity_type;

alter type public.content_opportunity_type
  rename value 'reel_video' to 'unspecified';

alter table public.content_opportunities
  alter column content_type set default 'unspecified'::public.content_opportunity_type;
