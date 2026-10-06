-- =====================================================================
-- Siembra de los 20 stands reales de Arequipa. Correr UNA VEZ, después
-- de schema.sql, en el SQL Editor.
--
-- `codigo` es el link de acceso de cada stand (/stand/:codigo) — entrégalo
-- una sola vez al encargado del stand (impreso, WhatsApp, etc.), lo dejan
-- abierto en el tablet/celular todo el evento, no hace falta volver a
-- ingresarlo (a diferencia del PIN de V2).
--
-- `codigo_sponsor` solo importa para los stands con panel_sponsor = true
-- (los 10 Diamante, por defecto) — es el link de /sponsor/:codigo que le
-- das a quien vea el Panel Sponsor en esa marca. En los que no tienen
-- panel activo, igual quedó generado por si Marketing lo activa después.
--
-- panel_sponsor = true por defecto SOLO en los Diamante — es un punto de
-- partida, no una regla fija: cámbialo con un UPDATE a `stands` o desde
-- el panel Mkt cuando esté listo, sin tocar código ni volver a correr esto.
-- =====================================================================

insert into public.stands (nombre, codigo, codigo_sponsor, tier, panel_sponsor, orden) values
  ('Planex',                          'planex-7fq2',     null,              'oro',            false, 1),
  ('ESET',                            'eset-m3dk',       null,              'oro',            false, 2),
  ('Innovastec',                      'innovastec-h8nx', 'spn-innov-k4wq',  'diamante',       true,  3),
  ('Macrotel',                        'macrotel-q9rv',   'spn-macro-t2lj',  'diamante',       true,  4),
  ('NVL',                             'nvl-4zcp',        'spn-nvl-9wke',    'diamante',       true,  5),
  ('Optictimes',                      'optictimes-b6ym', 'spn-optict-r5hf', 'diamante',       true,  6),
  ('Ring Ring & Energy Corporation',  'ringring-p2xd',   'spn-ringr-c7vt',  'diamante',       true,  7),
  ('TP-Link',                         'tplink-s8fn',     'spn-tplink-m1qz', 'diamante',       true,  8),
  ('Transwold',                      'transwold-k5jb',  'spn-transw-d9gy', 'diamante',       true,  9),
  ('Wanglink',                        'wanglink-x3hc',   'spn-wangl-v6tn',  'diamante',       true,  10),
  ('Fiberlux',                        'fiberlux-w7pk',   'spn-fbx-a4rq',    'diamante',       true,  11),
  ('Brothers',                        'brothers-u9md',   null,              'oro',            false, 12),
  ('Lanly',                           'lanly-e2sf',      null,              'oro',            false, 13),
  ('Latic',                           'latic-g6tw',      null,              'oro',            false, 14),
  ('Lieferant',                       'lieferant-j4nc',  null,              'oro',            false, 15),
  ('Wurfel',                          'wurfel-y8rp',     null,              'oro',            false, 16),
  ('Optronics',                       'optronics-l3vb',  null,              'oro',            false, 17),
  ('Hayex',                           'hayex-z7mq',      'spn-hayex-f5kd',  'diamante',       true,  18),
  ('Tecsup',                          'tecsup-d1xh',     null,              'complementario', false, 19),
  ('Mic',                             'mic-n6wa',        null,              'complementario', false, 20),
  ('Peplink',                         'peplink-3xqd',    null,              'complementario', false, 21);
