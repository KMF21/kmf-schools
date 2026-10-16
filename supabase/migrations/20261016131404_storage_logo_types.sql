-- Logos: allow PNG, JPG and WebP only. SVG files can contain scripts.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'school-assets';
