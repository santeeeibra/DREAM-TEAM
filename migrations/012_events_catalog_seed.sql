-- Carga 15 eventos narrativos en events_catalog.
-- El slug legible (ej. paq_lesion_titular) va en `code`, que es la columna
-- unica que referencia season_events.event_code (ver 001_init.sql). `id` es
-- uuid autogenerado por la tabla, no lo tocamos.
-- Re-ejecutable: ON CONFLICT (code) DO UPDATE.

INSERT INTO events_catalog (code, title, description, min_matchday, weight, options)
VALUES
  (
    'paq_lesion_titular',
    'Se resintió',
    'El cuerpo médico avisa que un titular llega justo. Vos decidís.',
    8,
    10,
    '[
      {"id": "preservar", "label": "Preservarlo", "effects": {"rating_efectivo": -3, "fatigue": -12}},
      {"id": "forzar", "label": "Que juegue igual", "effects": {"fatigue": 15, "morale": -4}}
    ]'::jsonb
  ),
  (
    'paq_crisis_resultados',
    'Reunión de urgencia',
    'La dirigencia convoca al cuerpo técnico. No es una charla amistosa.',
    19,
    10,
    '[
      {"id": "aguantar", "label": "Aguantar el chubasco", "effects": {"pressure": 15, "morale": -5}},
      {"id": "prometer", "label": "Prometer refuerzos que no hay", "effects": {"money": -400000, "pressure": 5}}
    ]'::jsonb
  ),
  (
    'paq_conflicto_referente',
    'El vestuario partido',
    'Un referente cuestiona el planteo por lo bajo y el grupo se entera.',
    8,
    8,
    '[
      {"id": "disciplinar", "label": "Ponerlo en su lugar", "effects": {"morale": -8, "pressure": 5}},
      {"id": "renovar", "label": "Comprar la paz con una renovación", "effects": {"money": -250000, "morale": -3}}
    ]'::jsonb
  ),
  (
    'paq_sancion',
    'Expediente abierto',
    'Un episodio en el partido anterior deriva en sanción.',
    8,
    8,
    '[
      {"id": "pagar", "label": "Pagar la multa y cerrar el tema", "effects": {"money": -350000}},
      {"id": "apelar", "label": "Apelar públicamente", "effects": {"pressure": 12, "morale": -4}}
    ]'::jsonb
  ),
  (
    'paq_calendario_apretado',
    'Tres partidos en ocho días',
    'El fixture se comprimió y no hay margen.',
    19,
    10,
    '[
      {"id": "titulares", "label": "Poner lo mejor cada fecha", "effects": {"fatigue": 20}},
      {"id": "rotar", "label": "Rotar sin plantel para rotar", "effects": {"rating_efectivo": -3, "fatigue": 5}}
    ]'::jsonb
  ),
  (
    'paq_carga_trabajo',
    'Doble turno',
    'El preparador físico propone subir la exigencia semanal.',
    1,
    10,
    '[
      {"id": "exigir", "label": "Apretar el acelerador", "effects": {"rating_efectivo": 2, "fatigue": 18}},
      {"id": "descansar", "label": "Priorizar el descanso", "effects": {"rating_efectivo": -2, "fatigue": -15}}
    ]'::jsonb
  ),
  (
    'paq_invertir_plantel',
    'Presupuesto de temporada',
    'Hay que decidir dónde va la plata que queda.',
    1,
    8,
    '[
      {"id": "invertir", "label": "Reforzar cuerpo técnico y comodidades", "effects": {"money": -300000, "morale": 10}},
      {"id": "recortar", "label": "Recortar y quedar bien con el directorio", "effects": {"money": 150000, "morale": -8}}
    ]'::jsonb
  ),
  (
    'paq_venta_figura',
    'Ofertón por el crack',
    'Llega una propuesta imposible de ignorar por tu mejor jugador.',
    30,
    8,
    '[
      {"id": "vender", "label": "Vender", "effects": {"money": 900000, "rating_efectivo": -4, "morale": -6}},
      {"id": "retener", "label": "Retenerlo a cualquier costo", "effects": {"money": -100000, "morale": 5, "pressure": 5}}
    ]'::jsonb
  ),
  (
    'paq_conferencia_prensa',
    'El micrófono abierto',
    'Te preguntan por el respaldo de la dirigencia. Todos escuchan.',
    8,
    10,
    '[
      {"id": "alinearse", "label": "Alinearte con el club", "effects": {"pressure": -12, "morale": -5}},
      {"id": "bancar", "label": "Bancar al plantel a cara de perro", "effects": {"pressure": 12, "morale": 8}}
    ]'::jsonb
  ),
  (
    'paq_apuesta_tactica',
    'Cambio de sistema',
    'El ayudante propone romper todo y reinventar el equipo a mitad de camino.',
    19,
    8,
    '[
      {"id": "arriesgar", "label": "Ir a fondo con el cambio", "effects": {"rating_efectivo": 5, "fatigue": 20, "pressure": 8}},
      {"id": "conservar", "label": "No tocar nada", "effects": {"morale": -2}}
    ]'::jsonb
  ),
  (
    'paq_juveniles',
    'Los pibes',
    'La reserva tiene una camada y el club quiere verla.',
    1,
    8,
    '[
      {"id": "subirlos", "label": "Subirlos y bancar el proceso", "effects": {"rating_efectivo": -3, "fatigue": -20, "morale": 6}},
      {"id": "esperar", "label": "Dejarlos madurar", "effects": {"rating_efectivo": 1, "fatigue": 12}}
    ]'::jsonb
  ),
  (
    'paq_ultimatum_vestuario',
    'Charla a puertas cerradas',
    'Es el momento de decir algo. O de callarse.',
    19,
    8,
    '[
      {"id": "arengar", "label": "Poner el pecho y prometer todo", "effects": {"morale": 15, "pressure": 15}},
      {"id": "perfilbajo", "label": "Bajar el perfil", "effects": {"morale": -3, "pressure": -5}}
    ]'::jsonb
  ),
  (
    'paq_mercado_oportunidad',
    'Ventana abierta',
    'Aparece un jugador libre que cambia el techo del equipo.',
    1,
    8,
    '[
      {"id": "fichar", "label": "Fichar", "effects": {"money": -600000, "rating_efectivo": 4}},
      {"id": "pasar", "label": "Dejarlo pasar", "effects": {"morale": -4, "pressure": 6}}
    ]'::jsonb
  ),
  (
    'paq_sponsor_exigente',
    'Contrato con letra chica',
    'Una marca pone plata sobre la mesa. Y expectativas.',
    1,
    10,
    '[
      {"id": "firmar", "label": "Firmar", "effects": {"money": 700000, "pressure": 18}},
      {"id": "rechazar", "label": "Rechazar y jugar tranquilo", "effects": {"pressure": -8}}
    ]'::jsonb
  ),
  (
    'paq_reconocimiento',
    'Reconocimiento',
    'El club quiere celebrar el momento del equipo.',
    30,
    8,
    '[
      {"id": "festejar", "label": "Festejo a lo grande", "effects": {"morale": 12, "fatigue": 8}},
      {"id": "bono", "label": "Bono discreto y a seguir", "effects": {"money": 200000, "morale": 2}}
    ]'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  min_matchday = excluded.min_matchday,
  weight = excluded.weight,
  options = excluded.options;
