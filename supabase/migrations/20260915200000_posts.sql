-- M4: founder-authored posts (L3) with images stored in a private Supabase Storage bucket.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('text', 'image', 'milestone')),
  body text not null default '' check (char_length(body) <= 500),
  milestone jsonb,
  -- pending_review: moderation was unavailable, or the post has images (only text is scanned).
  moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending_review')),
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((kind = 'milestone') = (milestone is not null))
);

create index posts_profile_timeline_idx on public.posts (profile_id, created_at desc, id desc)
  where deleted_at is null;
create index posts_deleted_at_idx on public.posts (deleted_at) where deleted_at is not null;
create index posts_created_at_idx on public.posts (created_at);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function private.set_updated_at();

alter table public.posts enable row level security;
revoke all on public.posts from anon;

create policy "posts read own"
on public.posts for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

-- Uploaded images. post_id stays null until the image is attached to a post; unattached uploads
-- are removed by the purge_posts worker after 24 hours.
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 3),
  storage_path text not null unique,
  thumbnail_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now()
);

create index post_media_post_idx on public.post_media (post_id, position);
create index post_media_profile_idx on public.post_media (profile_id, created_at desc);
create index post_media_created_at_idx on public.post_media (created_at);

alter table public.post_media enable row level security;
revoke all on public.post_media from anon;

create policy "post media read own"
on public.post_media for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

-- Private bucket: the API (service role) uploads and hands out short-lived signed URLs.
-- 10MB leaves room for re-encoded PNGs; the API itself only accepts uploads up to 5MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
