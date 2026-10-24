-- Dados de exemplo do portal (os mesmos da antiga API local em SQLite).
-- `supabase db reset` roda este arquivo depois das migrações. No projeto hospedado, rode uma vez
-- no SQL Editor para ter os dados da demonstração.
--
-- recriar_dados_exemplo() APAGA TODAS AS CONTAS E DADOS e grava os de exemplo de novo. Os testes
-- a chamam antes de cada caso. Só o dono do banco executa: a API (anon/authenticated) não.
--
-- Contas (senha de todas: teste123):
-- - carlos@exemplo.com
-- - beatriz@exemplo.com
-- - admin@exemplo.com

create or replace function public.recriar_dados_exemplo() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users;
  delete from public.professionals;
  delete from public.professions;
  delete from public.plan_settings;

  insert into public.professions (id, name, tasks, position) values
    ('eletricista', 'Eletricista', '{"Instalar chuveiro","Trocar tomada ou interruptor","Revisar quadro de energia"}', 0),
    ('faxineira', 'Faxineira', '{"Faxina completa","Limpeza pós-obra","Limpeza de vidros"}', 1),
    ('diarista', 'Diarista', '{"Diária de limpeza","Passar roupa","Organizar armários"}', 2),
    ('encanador', 'Encanador', '{"Consertar vazamento","Trocar torneira","Desentupir pia ou ralo"}', 3),
    ('pedreiro', 'Pedreiro', '{"Assentar piso","Rebocar parede","Pequena reforma"}', 4),
    ('pintor', 'Pintor', '{"Pintar cômodo","Pintar portão","Aplicar textura"}', 5),
    ('montador', 'Montador', '{"Montar guarda-roupa","Instalar painel de TV","Montar cozinha"}', 6),
    ('jardineiro', 'Jardineiro', '{"Podar árvores","Plantar grama","Limpar lote"}', 7),
    ('chaveiro', 'Chaveiro', '{"Abrir porta","Trocar fechadura","Fazer cópia de chave"}', 8);

  -- O perfil (public.profiles) nasce pelo gatilho nova_conta
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token
  )
  select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
    extensions.crypt('teste123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', u.name), now(), now(),
    '', '', '', '', '', ''
  from (values
    ('00000000-0000-4000-8000-000000000001', 'carlos@exemplo.com', 'Carlos Henrique'),
    ('00000000-0000-4000-8000-000000000002', 'beatriz@exemplo.com', 'Beatriz Rocha'),
    ('00000000-0000-4000-8000-000000000003', 'admin@exemplo.com', 'Administração')
  ) as u (id, email, name);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u;

  update public.profiles set neighborhood = 'Setor Bueno', city = 'Goiânia', state = 'GO', is_admin = false, phone = '62900000001', photo = 'exemplos/p1.png'
  where id = '00000000-0000-4000-8000-000000000001';
  update public.profiles set neighborhood = 'Setor Marista', city = 'Goiânia', state = 'GO', is_admin = false, phone = '', photo = null
  where id = '00000000-0000-4000-8000-000000000002';
  update public.profiles set neighborhood = '', city = '', state = '', is_admin = true, phone = '', photo = null
  where id = '00000000-0000-4000-8000-000000000003';

  insert into public.professionals (id, account_id, name, neighborhood, whatsapp, photo, about, status, rating, reviews)
  values
    ('p1', '00000000-0000-4000-8000-000000000001'::uuid, 'Carlos Henrique', 'Setor Bueno', '62900000001', 'exemplos/p1.png', 'Eletricista há 15 anos, atendo casas e apartamentos na região sul. Levo o material básico e deixo tudo limpo no final.', 'publicado', 4.9, 132),
    ('p2', null, 'Marcos Vinícius', 'Jardim América', '62900000002', 'exemplos/p2.png', '', 'publicado', 4.7, 58),
    ('p3', null, 'Rafael Souza', 'Setor Oeste', '62900000003', 'exemplos/p3.png', '', 'publicado', 5, 3),
    ('p4', null, 'Maria das Graças', 'Setor Marista', '62900000004', 'exemplos/p4.png', 'Faço faxina com produtos próprios. Atendo de segunda a sábado.', 'publicado', 4.8, 210),
    ('p5', null, 'Joana Pereira', 'Setor Bueno', '62900000005', 'exemplos/p5.png', '', 'publicado', 4.6, 74),
    ('p6', null, 'Luciana Alves', 'Vila Nova', '62900000006', 'exemplos/p6.png', '', 'publicado', 4.9, 41),
    ('p7', null, 'Ana Cláudia', 'Setor Sul', '62900000007', 'exemplos/p7.png', '', 'publicado', 4.9, 156),
    ('p8', null, 'Rosângela Lima', 'Jardim Goiás', '62900000008', 'exemplos/p8.png', '', 'publicado', 4.5, 89),
    ('p9', null, 'Francisca Melo', 'Setor Oeste', '62900000009', 'exemplos/p9.png', '', 'publicado', 4.8, 12),
    ('p10', null, 'José Antônio', 'Setor Coimbra', '62900000010', 'exemplos/p10.png', '', 'publicado', 4.8, 97),
    ('p11', null, 'Paulo Roberto', 'Setor Bueno', '62900000011', 'exemplos/p11.png', '', 'publicado', 4.6, 143),
    ('p12', null, 'Diego Martins', 'Vila Nova', '62900000012', 'exemplos/p12.png', '', 'publicado', 4.2, 20),
    ('p13', null, 'Antônio Carlos', 'Jardim América', '62900000013', 'exemplos/p13.png', '', 'publicado', 4.7, 64),
    ('p14', null, 'Sebastião Ribeiro', 'Setor Sul', '62900000014', 'exemplos/p14.png', '', 'publicado', 4.9, 37),
    ('p15', null, 'Wesley Gomes', 'Setor Campinas', '62900000015', 'exemplos/p15.png', '', 'publicado', 4.4, 15),
    ('p16', null, 'Fernando Dias', 'Setor Marista', '62900000016', 'exemplos/p16.png', '', 'publicado', 4.8, 112),
    ('p17', null, 'Leandro Costa', 'Setor Bueno', '62900000017', 'exemplos/p17.png', '', 'publicado', 4.6, 45),
    ('p18', null, 'Thiago Rocha', 'Jardim Goiás', '62900000018', 'exemplos/p18.png', '', 'publicado', 5, 6),
    ('p19', null, 'Bruno Teixeira', 'Setor Oeste', '62900000019', 'exemplos/p19.png', '', 'publicado', 4.9, 188),
    ('p20', null, 'Gustavo Nunes', 'Setor Coimbra', '62900000020', 'exemplos/p20.png', '', 'publicado', 4.5, 60),
    ('p21', null, 'João Batista', 'Jardim América', '62900000021', 'exemplos/p21.png', '', 'publicado', 4.7, 52),
    ('p22', null, 'Edson Ferreira', 'Setor Campinas', '62900000022', 'exemplos/p22.png', '', 'publicado', 4.8, 23),
    ('p23', null, 'Ricardo Lopes', 'Setor Central', '62900000023', 'exemplos/p23.png', 'Atendimento 24 horas para abertura de portas.', 'publicado', 4.9, 301),
    ('p24', null, 'Mateus Freitas', 'Setor Sul', '62900000024', 'exemplos/p24.png', '', 'publicado', 4.4, 76);

  insert into public.services (professional_id, profession_id, name, price, position) values
    ('p1', 'eletricista', 'Instalar chuveiro', 150, 0),
    ('p1', 'eletricista', 'Trocar tomada ou interruptor', 60, 1),
    ('p1', 'eletricista', 'Revisar quadro de energia', 250, 2),
    ('p2', 'eletricista', 'Instalar chuveiro', 120, 0),
    ('p2', 'eletricista', 'Trocar tomada ou interruptor', 50, 1),
    ('p3', 'eletricista', 'Instalar chuveiro', null, 0),
    ('p3', 'eletricista', 'Trocar tomada ou interruptor', 70, 1),
    ('p3', 'eletricista', 'Revisar quadro de energia', null, 2),
    ('p4', 'faxineira', 'Faxina completa', 220, 0),
    ('p4', 'faxineira', 'Limpeza pós-obra', 350, 1),
    ('p4', 'faxineira', 'Limpeza de vidros', 150, 2),
    ('p5', 'faxineira', 'Faxina completa', 180, 0),
    ('p5', 'faxineira', 'Limpeza de vidros', 120, 1),
    ('p6', 'faxineira', 'Faxina completa', 200, 0),
    ('p6', 'faxineira', 'Limpeza pós-obra', null, 1),
    ('p6', 'faxineira', 'Limpeza de vidros', 130, 2),
    ('p7', 'diarista', 'Diária de limpeza', 160, 0),
    ('p7', 'diarista', 'Passar roupa', 120, 1),
    ('p7', 'diarista', 'Organizar armários', 140, 2),
    ('p8', 'diarista', 'Diária de limpeza', 150, 0),
    ('p8', 'diarista', 'Passar roupa', 100, 1),
    ('p9', 'diarista', 'Diária de limpeza', 170, 0),
    ('p9', 'diarista', 'Passar roupa', null, 1),
    ('p9', 'diarista', 'Organizar armários', 150, 2),
    ('p10', 'encanador', 'Consertar vazamento', 140, 0),
    ('p10', 'encanador', 'Trocar torneira', 80, 1),
    ('p10', 'encanador', 'Desentupir pia ou ralo', 120, 2),
    ('p11', 'encanador', 'Consertar vazamento', 130, 0),
    ('p11', 'encanador', 'Desentupir pia ou ralo', 100, 1),
    ('p12', 'encanador', 'Consertar vazamento', null, 0),
    ('p12', 'encanador', 'Trocar torneira', 70, 1),
    ('p12', 'encanador', 'Desentupir pia ou ralo', 90, 2),
    ('p13', 'pedreiro', 'Assentar piso', 60, 0),
    ('p13', 'pedreiro', 'Rebocar parede', 45, 1),
    ('p13', 'pedreiro', 'Pequena reforma', null, 2),
    ('p14', 'pedreiro', 'Assentar piso', 55, 0),
    ('p14', 'pedreiro', 'Pequena reforma', null, 1),
    ('p15', 'pedreiro', 'Assentar piso', 50, 0),
    ('p15', 'pedreiro', 'Rebocar parede', 40, 1),
    ('p15', 'pedreiro', 'Pequena reforma', null, 2),
    ('p16', 'pintor', 'Pintar cômodo', 450, 0),
    ('p16', 'pintor', 'Pintar portão', 250, 1),
    ('p16', 'pintor', 'Aplicar textura', 600, 2),
    ('p17', 'pintor', 'Pintar cômodo', 400, 0),
    ('p17', 'pintor', 'Aplicar textura', 550, 1),
    ('p18', 'pintor', 'Pintar cômodo', 380, 0),
    ('p18', 'pintor', 'Pintar portão', null, 1),
    ('p18', 'pintor', 'Aplicar textura', null, 2),
    ('p19', 'montador', 'Montar guarda-roupa', 200, 0),
    ('p19', 'montador', 'Instalar painel de TV', 120, 1),
    ('p19', 'montador', 'Montar cozinha', 450, 2),
    ('p20', 'montador', 'Montar guarda-roupa', 180, 0),
    ('p20', 'montador', 'Montar cozinha', 400, 1),
    ('p21', 'jardineiro', 'Podar árvores', 180, 0),
    ('p21', 'jardineiro', 'Plantar grama', null, 1),
    ('p21', 'jardineiro', 'Limpar lote', 250, 2),
    ('p22', 'jardineiro', 'Podar árvores', 150, 0),
    ('p22', 'jardineiro', 'Limpar lote', 220, 1),
    ('p23', 'chaveiro', 'Abrir porta', 120, 0),
    ('p23', 'chaveiro', 'Trocar fechadura', 150, 1),
    ('p23', 'chaveiro', 'Fazer cópia de chave', 15, 2),
    ('p24', 'chaveiro', 'Fazer cópia de chave', 12, 0),
    ('p24', 'chaveiro', 'Trocar fechadura', 140, 1);

  insert into public.reviews (id, professional_id, author, rating, comment, date) values
    ('r1', 'p1', 'Fernanda', 5, 'Instalou o chuveiro rapidinho e explicou tudo. Muito educado.', '2026-10-12'),
    ('r2', 'p1', 'Roberto', 5, 'Chegou no horário combinado e o preço foi o que tinha falado.', '2026-10-03'),
    ('r3', 'p1', 'Juliana', 4, 'Bom serviço, só demorou um pouco para responder.', '2026-09-21'),
    ('r4', 'p1', 'Marcelo', 5, 'Resolveu um problema no quadro que outro eletricista não achou.', '2026-09-08'),
    ('r5', 'p4', 'Patrícia', 5, 'Casa impecável. Já marquei de novo.', '2026-10-10'),
    ('r6', 'p4', 'Lucas', 4, 'Caprichosa e pontual.', '2026-09-30'),
    ('r7', 'p23', 'Carla', 5, 'Abriu a porta em dez minutos, de madrugada.', '2026-10-15');

  insert into public.contacts (id, professional_id, client, task, message, neighborhood, date, answered) values
    ('c1', 'p1', 'Beatriz', 'Instalar chuveiro', 'Chuveiro novo de 220V, o antigo queimou.', 'Setor Bueno', '2026-10-19', false),
    ('c2', 'p1', 'André', 'Revisar quadro de energia', 'O disjuntor desarma quando ligo o forno.', 'Setor Marista', '2026-10-18', false),
    ('c3', 'p1', 'Sônia', 'Trocar tomada ou interruptor', 'São 4 tomadas na sala e 2 interruptores.', 'Setor Oeste', '2026-10-15', true),
    ('c4', 'p1', 'Gabriel', 'Instalar chuveiro', '', 'Jardim América', '2026-10-11', true);

  insert into public.plan_settings (id, monthly_price, semiannual_price, trial_days, gateway, pix_enabled, card_enabled)
  values (1, 19.9, 99.9, 15, 'mercadopago', true, true);
end
$$;

revoke execute on function public.recriar_dados_exemplo() from public, anon, authenticated;

select public.recriar_dados_exemplo();
