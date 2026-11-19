-- VoltStore: патчи безопасности, применены 2026-11-19 в Supabase SQL Editor.

-- 1) Телефон отдаётся только владельцу, администратору или если у пользователя есть активное объявление.
create or replace function public.seller_phone(p_uid uuid)
returns text language sql stable security definer
set search_path to 'public'
as $$
  select case
    when auth.uid() is not null and not public.is_banned()
     and ( p_uid = auth.uid()
           or public.is_admin()
           or exists (select 1 from public.ads a
                      where a.seller_id = p_uid
                        and a.status in ('active','reserved')) )
    then (select phone from public.profiles where id = p_uid and not banned)
  end
$$;

-- 2) Правка одобренного объявления (цена, состояние, память, город, фото, описание)
--    возвращает его на повторную модерацию.
create or replace function public.ads_guard()
returns trigger language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if coalesce(new.photos, '{}') <> '{}' and exists (
      select 1 from unnest(new.photos) p
      where p not like new.seller_id::text || '/%') then
    raise exception 'bad_photo';
  end if;
  -- Внутри security definer-функций current_user = владелец, там проверки уже сделаны.
  if tg_op = 'INSERT' or current_user <> 'authenticated' then return new; end if;

  if new.status <> old.status then
    if not ((old.status = 'active'   and new.status in ('removed','sold'))
         or (old.status = 'pending'  and new.status = 'removed')
         or (old.status = 'rejected' and new.status in ('pending','removed'))) then
      raise exception 'bad_status';
    end if;
  elsif old.status = 'reserved' then
    raise exception 'bad_status';           -- пока идёт сделка, объявление менять нельзя
  elsif (new.model, new.note, new.photos, new.price, new.mem, new.cond, new.bat, new.city)
        is distinct from
        (old.model, old.note, old.photos, old.price, old.mem, old.cond, old.bat, old.city)
        and old.status in ('active','rejected') then
    new.status := 'pending';                -- правка содержимого -> повторная модерация
    new.reject_reason := null;
  end if;
  return new;
end
$function$;
