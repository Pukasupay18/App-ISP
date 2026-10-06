-- =====================================================================
-- Siembra del cronograma real del evento, tomado del Sheet "Cronogama"
-- (hoja "Hoja 1"). Correr UNA VEZ, después de schema.sql. Si el horario
-- cambia antes del evento, edítalo desde Configuración en el panel Mkt
-- en vez de volver a correr este archivo (evita duplicar filas).
-- =====================================================================
insert into public.cronograma (hora, actividad, expositor, orden) values
  ('08:30 - 09:00', 'Registro de Asistentes', null, 1),
  ('09:10 - 09:30', 'Palabras de Bienvenida', null, 2),
  ('09:30 - 10:00', 'Tema de Ponencia', 'V-SOL / Telecom', 3),
  ('10:00 - 11:00', 'Taller', 'MCT Comunicaciones Macrote', 4),
  ('11:00 - 12:00', 'Coffee break', null, 5),
  ('12:00 - 12:30', 'Tema de Ponencia', 'Agility / TP-Link', 6),
  ('12:30 - 13:00', 'Tema de Ponencia', 'Fiberlux', 7),
  ('13:00 - 15:00', 'Break almuerzo', null, 8),
  ('15:00 - 16:00', 'Taller', 'NVL International', 9),
  ('16:00 - 16:30', 'Tema de Ponencia', 'WangLink', 10),
  ('16:30 - 17:00', 'Tema de Ponencia', 'HT Mega Technology', 11),
  ('17:00 - 17:30', 'Tema de Ponencia', 'Innovastec', 12),
  ('17:30 - 18:00', 'Tema de Ponencia', 'Planex Technologies', 13),
  ('18:00 - 18:30', 'Tema de Ponencia', 'Tecsup', 14),
  ('18:30 - 21:00', 'Cocktail', null, 15);
