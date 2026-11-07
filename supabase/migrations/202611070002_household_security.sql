-- Projeto de Vida: tighten household access and cap the shared workspace at two members.
drop policy if exists "members update own row" on public.household_members;
drop policy if exists "members manage invites" on public.household_invites;
drop policy if exists "members update household" on public.households;
drop policy if exists "owner updates household" on public.households;
create policy "owner updates household" on public.households for update to authenticated
using (exists (select 1 from public.household_members m where m.household_id = households.id and m.user_id = auth.uid() and m.role = 'owner'))
with check (exists (select 1 from public.household_members m where m.household_id = households.id and m.user_id = auth.uid() and m.role = 'owner'));
create policy "owner reads invites" on public.household_invites for select to authenticated
using (exists (select 1 from public.household_members m where m.household_id = household_invites.household_id and m.user_id = auth.uid() and m.role = 'owner'));
create policy "owner creates invites" on public.household_invites for insert to authenticated
with check (exists (select 1 from public.household_members m where m.household_id = household_invites.household_id and m.user_id = auth.uid() and m.role = 'owner'));
create policy "owner deletes invites" on public.household_invites for delete to authenticated
using (exists (select 1 from public.household_members m where m.household_id = household_invites.household_id and m.user_id = auth.uid() and m.role = 'owner'));
create or replace function public.enforce_two_household_members()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
 perform 1 from public.households where id = new.household_id for update;
 select count(*) into n from public.household_members where household_id = new.household_id;
 if n >= 2 then raise exception 'Este espaço já possui os dois membros permitidos.'; end if;
 return new;
end; $$;
drop trigger if exists enforce_two_household_members_trigger on public.household_members;
create trigger enforce_two_household_members_trigger before insert on public.household_members for each row execute function public.enforce_two_household_members();
create or replace function public.create_household_invite(p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid; invite_id uuid; n integer; normalized text := lower(trim(p_email));
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select household_id into h from public.household_members where user_id=auth.uid() and role='owner' limit 1;
 if h is null then raise exception 'Somente o administrador pode convidar membros.'; end if;
 if normalized='' or position('@' in normalized)<2 then raise exception 'E-mail inválido.'; end if;
 perform 1 from public.households where id=h for update;
 select count(*) into n from public.household_members where household_id=h;
 if n>=2 then raise exception 'O espaço já possui dois membros.'; end if;
 insert into public.household_invites(household_id,email,invited_by) values(h,normalized,auth.uid())
 on conflict(household_id,email) do update set invited_by=excluded.invited_by,accepted_at=null,updated_at=now() returning id into invite_id;
 return invite_id;
end; $$;
grant execute on function public.create_household_invite(text) to authenticated;
