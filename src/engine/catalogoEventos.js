// PURA y VERSIONADA. §2.3: los números de consecuencias viven ACÁ y sólo acá.
// La IA nunca produce efectos: sólo elige un id de esta tabla y escribe el texto.
// `titulo`/`texto`/`label` son el RESPALDO fijo (se usan si la IA falla o está apagada).
//
// Rediseño v2: cada evento tiene una INTENSIDAD que limita cuántas veces puede volver
// a salir (ver candidatosEvento.js): alta = 1 vez por carrera, media = 1 vez por
// temporada, baja = hasta 3 veces por temporada. Muchas opciones ya no tienen un
// único `efectos` fijo sino un `resultado` (rama probabilística: 50/50, 60/40, 70/30…)
// que se sortea recién al resolver la elección (ver resolverOpcion en candidatosEvento.js).
// Sigue siendo la IA quien narra, nunca quien decide magnitudes o probabilidades.
export const CATALOGO_VERSION = '2.0.0';

export const INTENSIDAD = { ALTA: 'alta', MEDIA: 'media', BAJA: 'baja' };

const PESO_POR_INTENSIDAD = { [INTENSIDAD.ALTA]: 6, [INTENSIDAD.MEDIA]: 9, [INTENSIDAD.BAJA]: 13 };

const p = (id, def) => ({
  id,
  intensidad: INTENSIDAD.BAJA,
  filtro: () => true,
  ...def,
  peso: def.peso ?? PESO_POR_INTENSIDAD[def.intensidad ?? INTENSIDAD.BAJA],
});

export const CATALOGO = [
  // ══════════════════════ FAMILIA: VESTUARIO ══════════════════════
  p('noche_antes_clasico', {
    tags: ['individual', 'vestuario'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => !!c.figura && !!c.rival,
    titulo: 'Llegó tarde y oliendo a fiesta',
    texto: '{figura} apareció pasada la medianoche, después de estar en un boliche. Mañana jugás con {rival} y todo el plantel ya se enteró.',
    opciones: [
      {
        id: 'cubrir', label: 'Cubrirlo y que juegue igual',
        resultado: [
          { prob: 0.6, nota: 'rinde normal, nadie se entera afuera', efectos: { ratingDelta: 1, fatiga: 4 } },
          { prob: 0.4, nota: 'sale mal y explota en la prensa', efectos: { ratingDelta: -3, presion: 15, moral: -6 }, tramo: { fuerza: -3 } },
        ],
      },
      {
        id: 'bajar', label: 'Dejarlo afuera del banco',
        resultado: [
          { prob: 0.7, nota: 'el plantel se enfoca igual', efectos: { moral: -10, ratingDelta: -1 } },
          { prob: 0.3, nota: 'igual se filtra a la prensa', efectos: { moral: -10, ratingDelta: -1, presion: 12 } },
        ],
      },
    ],
  }),
  p('pelea_vestuario', {
    tags: ['vestuario'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.moral <= 50,
    titulo: 'Se fueron a las manos en el vestuario',
    texto: 'Dos titulares terminaron a las trompadas después de la derrota. Los separaron entre todos, pero ambos te piden que eches al otro.',
    opciones: [
      {
        id: 'echar', label: 'Echar al que empezó todo',
        resultado: [
          { prob: 0.5, nota: 'el plantel lo acepta', efectos: { moral: 8, ratingDelta: -3 } },
          { prob: 0.5, nota: 'el plantel se divide', efectos: { moral: -6, presion: 8, ratingDelta: -3 } },
        ],
      },
      {
        id: 'perdonar', label: 'Hablar con los dos y perdonar',
        resultado: [
          { prob: 0.6, nota: 'se calma', efectos: { moral: 4, fatiga: -2 } },
          { prob: 0.4, nota: 'sigue la tensión toda la temporada', efectos: { moral: -8, presion: 6 } },
        ],
      },
    ],
  }),
  p('capitan_cuestiona_tactica', {
    tags: ['vestuario', 'prensa'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo >= 1,
    titulo: 'El capitán habló de más en la radio',
    texto: 'Dijo en una nota que "el equipo no juega bien por el sistema". No te avisó antes. Ahora todos esperan tu respuesta.',
    opciones: [
      {
        id: 'confrontar', label: 'Confrontarlo puertas adentro',
        resultado: [
          { prob: 0.7, nota: 'se arregla', efectos: { moral: 5, presion: -3 } },
          { prob: 0.3, nota: 'se va con el problema al presidente', efectos: { moral: -6, presion: 10 } },
        ],
      },
      {
        id: 'ignorar', label: 'Dejarlo pasar sin decir nada',
        resultado: [
          { prob: 0.55, nota: 'se olvida', efectos: { presion: -2 } },
          { prob: 0.45, nota: 'otros empiezan a hablar también', efectos: { moral: -7, presion: 6 } },
        ],
      },
    ],
  }),
  p('idolo_quiere_retirarse', {
    tags: ['plantel', 'hinchada'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 3,
    titulo: 'El histórico del club te pidió firmar',
    texto: 'Ya no rinde como antes, pero es un símbolo y quiere retirarse con esta camiseta. La hinchada lo sabe y lo espera.',
    opciones: [
      { id: 'firmar', label: 'Firmarlo para que cierre acá', efectos: { presion: -10, moral: 12, ratingDelta: -2 } },
      {
        id: 'rechazar', label: 'Rechazarlo, priorizar el rendimiento',
        resultado: [
          { prob: 0.4, nota: 'la hinchada lo entiende', efectos: { presion: 2, moral: -3 } },
          { prob: 0.6, nota: 'presión por "traicionar al ídolo"', efectos: { presion: 20, moral: -8 } },
        ],
      },
    ],
  }),
  p('figura_en_crisis', {
    tags: ['individual', 'plantel'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => !!c.figura && c.temporada >= 2,
    titulo: '{figura} lleva dos semanas sin aparecer',
    texto: 'No fue a entrenar, no contesta. La familia dice que está mal emocionalmente y pide tiempo. La prensa ya empezó a preguntar.',
    opciones: [
      {
        id: 'buscar', label: 'Ir a buscarlo personalmente',
        resultado: [
          { prob: 0.65, nota: 'vuelve comprometido', efectos: { moral: 10, ratingDelta: 2 } },
          { prob: 0.35, nota: 'no responde, perdés tiempo', efectos: { moral: -3, fatiga: 5 } },
        ],
      },
      {
        id: 'baja', label: 'Darle la baja del plantel',
        resultado: [
          { prob: 0.5, nota: 'el equipo lo entiende', efectos: { moral: 3, presion: -4 } },
          { prob: 0.5, nota: 'te ven frío con alguien en crisis', efectos: { moral: -9, presion: 6 } },
        ],
      },
    ],
  }),

  // ══════════════════════ FAMILIA: DIRIGENCIA / INSTITUCIONAL ══════════════════════
  p('presidente_vende_figura', {
    tags: ['individual', 'mercado'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.tramo <= 4,
    titulo: 'El presidente ya arregló la venta de {figura}',
    texto: 'Ochenta millones por tu mejor jugador. Dice que es "irrechazable" y que ya avisó a la prensa. A vos nadie te preguntó.',
    opciones: [
      {
        id: 'resistir', label: 'Plantarte y resistir la venta',
        resultado: [
          { prob: 0.55, nota: 'el presidente cede', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'te tildan de "conflictivo"', efectos: { presion: 18, moral: -3 } },
        ],
      },
      {
        id: 'negociar', label: 'Aceptar y negociar el reemplazo',
        resultado: [
          { prob: 0.6, nota: 'el reemplazo llega bien', efectos: { money: 14, ratingDelta: -4 } },
          { prob: 0.4, nota: 'el reemplazo no llega a tiempo', efectos: { money: 14, ratingDelta: -7 } },
        ],
      },
    ],
  }),
  p('denuncia_corrupcion', {
    tags: ['dirigencia'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Investigan a la dirigencia por corrupción',
    texto: 'Salió en todos los diarios: hay una causa abierta contra gente del club. El plantel te pregunta si esto los afecta a ellos también.',
    opciones: [
      {
        id: 'hablar', label: 'Hablar con el plantel y bajar línea',
        resultado: [
          { prob: 0.7, nota: 'los tranquilizás', efectos: { moral: 6, presion: -6 } },
          { prob: 0.3, nota: 'el discurso se filtra y es peor', efectos: { moral: -8, presion: 10 } },
        ],
      },
      {
        id: 'silencio', label: 'Guardar silencio y seguir laburando',
        resultado: [
          { prob: 0.6, nota: 'se olvida en una semana', efectos: { presion: -3 } },
          { prob: 0.4, nota: 'los rumores crecen', efectos: { moral: -15, presion: 8 } },
        ],
      },
    ],
  }),
  p('sponsor_exige_minutos', {
    tags: ['mercado', 'dirigencia'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.money <= 20,
    titulo: 'El sponsor pide minutos para su jugador',
    texto: 'El que pone la plata de la camiseta quiere ver a su protegido jugar, aunque no dé el nivel. El presidente ya te avisó que "hay que cuidar la relación".',
    opciones: [
      {
        id: 'ceder', label: 'Darle minutos aunque no rinda',
        resultado: [
          { prob: 0.65, nota: 'nadie lo nota', efectos: { money: 7 } },
          { prob: 0.35, nota: 'la prensa lo expone', efectos: { money: 7, presion: 10, moral: -4 } },
        ],
      },
      {
        id: 'negar', label: 'Plantarte: juega el que se lo gana',
        resultado: [
          { prob: 0.7, nota: 'te respetan internamente', efectos: { moral: 5 } },
          { prob: 0.3, nota: 'fricción con el presidente', efectos: { presion: 12, money: -2 } },
        ],
      },
    ],
  }),
  p('oferta_para_vos', {
    tags: ['dirigencia'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 3 && c.posicion <= 10,
    titulo: 'Te ofrecen dirigir en otro lado',
    texto: 'Llegó una propuesta seria de otro club, mejor sueldo y plantilla armada. Tu contrato acá vence en seis meses y el presidente ya se enteró.',
    opciones: [
      {
        id: 'rechazar', label: 'Rechazarla en público',
        resultado: [
          { prob: 0.6, nota: 'te renuevan tranquilo', efectos: { moral: 10, presion: -8 } },
          { prob: 0.4, nota: 'igual no te renuevan, sigue la incertidumbre', efectos: { moral: 10, presion: -2 } },
        ],
      },
      {
        id: 'negociar', label: 'Negociar en silencio tu renovación',
        resultado: [
          { prob: 0.55, nota: 'conseguís mejor contrato', efectos: { money: -3, moral: 4 } },
          { prob: 0.45, nota: 'se filtra, vestuario dividido', efectos: { moral: -9, presion: 8 } },
        ],
      },
    ],
  }),
  p('manipulacion_sospechosa', {
    tags: ['dirigencia'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Un intermediario te ofreció arreglar el resultado',
    texto: '"Solo necesitamos que no ganes por más de dos" te dijo, como si fuera un favor entre amigos. Nadie más lo sabría, asegura.',
    opciones: [
      {
        id: 'reportar', label: 'Rechazarlo y denunciarlo',
        resultado: [
          { prob: 0.7, nota: 'no pasa nada', efectos: { presion: -5, moral: 5 } },
          { prob: 0.3, nota: 'igual te investigan a vos', efectos: { presion: 10, moral: 5 } },
        ],
      },
      {
        id: 'ignorar', label: 'Ignorarlo sin decir nada',
        resultado: [
          { prob: 0.8, nota: 'no pasa nada', efectos: {} },
          { prob: 0.2, nota: 'aparecés en la investigación igual', efectos: { presion: 30, moral: -15 } },
        ],
      },
    ],
  }),

  // ══════════════════════ FAMILIA: INDIVIDUAL ══════════════════════
  p('doping_positivo', {
    tags: ['individual'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => !!c.figura && c.temporada >= 2,
    titulo: 'El control antidoping de {figura} dio positivo',
    texto: 'Jura que fue un suplemento que le recomendó el nutricionista. Tenés 48 horas antes de que esto explote en la prensa.',
    opciones: [
      {
        id: 'defender', label: 'Defenderlo públicamente',
        resultado: [
          { prob: 0.55, nota: 'la apelación prospera', efectos: { moral: 6, presion: -4 } },
          { prob: 0.45, nota: 'manchás al club también', efectos: { presion: 18, moral: -6 } },
        ],
      },
      {
        id: 'distanciarte', label: 'Tomar distancia y proteger al club',
        resultado: [
          { prob: 0.7, nota: 'el jugador lo entiende', efectos: { presion: -8 } },
          { prob: 0.3, nota: 'rompe relación para siempre', efectos: { moral: -10, presion: -8 } },
        ],
      },
    ],
  }),
  p('figura_pide_mas_plata', {
    tags: ['individual', 'mercado'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.temporada >= 2,
    titulo: '{figura} filtró que no renueva',
    texto: 'Quiere duplicar el sueldo o se va libre a fin de año. El club no tiene ese presupuesto y vos te enteraste por la prensa.',
    opciones: [
      {
        id: 'pedir_fondos', label: 'Pedirle el esfuerzo al presidente',
        resultado: [
          { prob: 0.5, nota: 'consiguen los fondos', efectos: { money: -8, moral: 6 } },
          { prob: 0.5, nota: 'te dicen que lo vendas', efectos: { presion: 10, moral: -4 } },
        ],
      },
      {
        id: 'hablar_proyecto', label: 'Convencerlo con el proyecto deportivo',
        resultado: [
          { prob: 0.6, nota: 'convencido, sigue', efectos: { moral: 5 } },
          { prob: 0.4, nota: 'igual se va, mal parado', efectos: { money: 10, ratingDelta: -5, moral: -6 } },
        ],
      },
    ],
  }),
  p('lesion_ocultada', {
    tags: ['individual'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.tramo >= 2,
    titulo: '{figura} jugó lesionado sin avisarte',
    texto: 'Te confesó después de la derrota que sintió un tirón en la entrada en calor y no dijo nada. Te pide que no lo expongas.',
    opciones: [
      {
        id: 'cubrir', label: 'Cubrirlo frente al cuerpo médico',
        resultado: [
          { prob: 0.65, nota: 'el vestuario lo valora', efectos: { moral: 5 } },
          { prob: 0.35, nota: 'la prensa lo descubre igual', efectos: { presion: 10, moral: -3 } },
        ],
      },
      {
        id: 'honesto', label: 'Ser honesto con el club',
        resultado: [
          { prob: 0.55, nota: 'el jugador lo entiende', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'te odia para siempre', efectos: { moral: -10 } },
        ],
      },
    ],
  }),
  p('juvenil_pide_prestamo', {
    tags: ['juveniles'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Tu juvenil pide salir a préstamo',
    texto: 'Tiene diecinueve años, no consigue minutos y hay un club esperando para llevárselo seis meses. Vos lo necesitás como recambio.',
    opciones: [
      {
        id: 'dejar_ir', label: 'Dejarlo ir a préstamo',
        resultado: [
          { prob: 0.7, nota: 'vuelve mejor', efectos: { moral: 4, ratingDelta: 1 } },
          { prob: 0.3, nota: 'el otro club lo termina comprando', efectos: { money: -2, ratingDelta: -1 } },
        ],
      },
      {
        id: 'retener', label: 'Retenerlo en el plantel',
        resultado: [
          { prob: 0.55, nota: 'rinde cuando entra', efectos: { ratingDelta: 2, moral: 2 } },
          { prob: 0.45, nota: 'se cierra emocionalmente', efectos: { moral: -5 } },
        ],
      },
    ],
  }),
  p('figura_vuelve_lesionada_seleccion', {
    tags: ['individual'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.tramo >= 1,
    titulo: '{figura} volvió roto de la selección',
    texto: 'Se lesionó en un amistoso que no tenía nada en juego. La federación dice que no es su responsabilidad. Vas a perder partidos importantes sin él.',
    opciones: [
      {
        id: 'comunicado', label: 'Sacar un comunicado público',
        resultado: [
          { prob: 0.6, nota: 'la prensa te apoya', efectos: { moral: 5, presion: -3 } },
          { prob: 0.4, nota: 'la federación te pone en la mira', efectos: { presion: 8 } },
        ],
      },
      {
        id: 'callarte', label: 'No decir nada y adaptarte',
        resultado: [
          { prob: 0.7, nota: 'te queda bien con todos', efectos: { presion: -4 } },
          { prob: 0.3, nota: 'sienten que no los defendés', efectos: { moral: -8 } },
        ],
      },
    ],
  }),

  // ══════════════════════ FAMILIA: TÁCTICA ══════════════════════
  p('tactica_expuesta', {
    tags: ['tactico'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.rival && c.tramo >= 2,
    titulo: 'El rival se sabe de memoria tu esquema',
    texto: 'Un ex ayudante tuyo trabaja del otro lado y filtró todo antes de jugar contra {rival}. Tenés que decidir qué hacer con lo que preparaste.',
    opciones: [
      {
        id: 'cambiar_todo', label: 'Cambiar el planteo a último momento',
        resultado: [
          { prob: 0.5, nota: 'los sorprendés', efectos: { presion: 2 }, tramo: { fuerza: 3 } },
          { prob: 0.5, nota: 'tu equipo se confunde más que el rival', efectos: { presion: 4, moral: -2 }, tramo: { fuerza: -3 } },
        ],
      },
      {
        id: 'mantener', label: 'Mantener el plan y ejecutarlo mejor',
        resultado: [
          { prob: 0.65, nota: 'ganás igual con calidad', efectos: { moral: 2 }, tramo: { fuerza: 1 } },
          { prob: 0.35, nota: 'el rival lo aprovecha al máximo', efectos: { moral: -3 }, tramo: { fuerza: -2 } },
        ],
      },
    ],
  }),
  p('arbitro_bajo_presion', {
    tags: ['tactico', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.tramo >= 1,
    titulo: 'Amenazaron al árbitro de tu próximo partido',
    texto: 'Circula que recibió presiones para favorecer al local. La federación no dice nada todavía y el partido se juega igual.',
    opciones: [
      {
        id: 'protestar', label: 'Protestar ante la federación',
        resultado: [
          { prob: 0.55, nota: 'cambian al árbitro', efectos: { presion: -3 } },
          { prob: 0.45, nota: 'te sancionan a vos por presionar', efectos: { presion: 10 } },
        ],
      },
      {
        id: 'preparar', label: 'Preparar al equipo para lo peor',
        resultado: [
          { prob: 0.7, nota: 'jugás tranquilo', efectos: { moral: 2 } },
          { prob: 0.3, nota: 'el árbitro efectivamente condiciona', efectos: { presion: 3 }, tramo: { fuerza: -2 } },
        ],
      },
    ],
  }),
  p('rotacion_forzada', {
    tags: ['tactico', 'entrenamiento'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.fatiga >= 40,
    titulo: 'Tres partidos en siete días',
    texto: 'El fixture no da tregua y tu once ideal está al límite físico. El presidente pide ganar los tres como si fuera fácil.',
    opciones: [
      {
        id: 'rotar', label: 'Rotar fuerte el plantel',
        resultado: [
          { prob: 0.65, nota: 'llegás fresco a los tres', efectos: { fatiga: -10 }, tramo: { fuerza: 1 } },
          { prob: 0.35, nota: 'perdés el primero y la presión explota', efectos: { presion: 6 }, tramo: { fuerza: -3 } },
        ],
      },
      {
        id: 'jugar_mejores', label: 'Jugar siempre con los mejores',
        resultado: [
          { prob: 0.55, nota: 'ganás los primeros dos', efectos: { fatiga: 8 }, tramo: { fuerza: 2 } },
          { prob: 0.45, nota: 'jugás con heridos el tercero', efectos: { fatiga: 14, presion: 5 }, tramo: { fuerza: -2 } },
        ],
      },
    ],
  }),
  p('favorito_no_rinde', {
    tags: ['individual', 'hinchada'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.moral <= 55,
    titulo: '{figura} lleva ocho partidos sin aportar',
    texto: 'Es el jugador que más quiere la hinchada, pero hace rato que no rinde. Si lo sacás del once, te van a silbar en la próxima fecha.',
    opciones: [
      {
        id: 'bajarlo', label: 'Sacarlo del once titular',
        resultado: [
          { prob: 0.6, nota: 'la hinchada lo acepta en dos fechas', efectos: { ratingDelta: 2 } },
          { prob: 0.4, nota: 'presión inmediata de la tribuna', efectos: { presion: 20 } },
        ],
      },
      {
        id: 'dar_fecha', label: 'Darle una fecha más de confianza',
        resultado: [
          { prob: 0.7, nota: 'rinde bajo presión', efectos: { ratingDelta: 3, moral: 4 } },
          { prob: 0.3, nota: 'sigue igual, ya perdiste puntos', efectos: { ratingDelta: -2, presion: 6 } },
        ],
      },
    ],
  }),
  p('formacion_polemica_final', {
    tags: ['tactico'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => !!c.rival && c.tramo >= 4 && c.posicion <= 5,
    titulo: 'Tenés una final y una idea arriesgada',
    texto: 'El análisis dice que una formación experimental te da más chances contra {rival}. Todos esperan que juegues como siempre.',
    opciones: [
      {
        id: 'arriesgar', label: 'Arriesgar con la formación experimental',
        resultado: [
          { prob: 0.45, nota: 'obra maestra', efectos: { moral: 8 }, tramo: { fuerza: 5 } },
          { prob: 0.55, nota: 'sos el culpable eterno', efectos: { presion: 15, moral: -8 }, tramo: { fuerza: -4 } },
        ],
      },
      {
        id: 'conservador', label: 'Ir con lo conocido y conservador',
        resultado: [
          { prob: 0.65, nota: 'resultado decente', efectos: { presion: -2 }, tramo: { fuerza: 1 } },
          { prob: 0.35, nota: 'ganás pero nadie te recuerda por eso', efectos: { moral: -3 }, tramo: { fuerza: 1 } },
        ],
      },
    ],
  }),

  // ══════════════════════ FAMILIA: AMBIENTE (baja intensidad) ══════════════════════
  p('tercera_vez_tarde', {
    tags: ['plantel'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.tramo >= 1,
    titulo: 'Llegó tarde al entrenamiento otra vez',
    texto: 'Es la tercera vez este mes que un titular llega tarde a la práctica. El resto del plantel ya lo empezó a notar.',
    opciones: [
      {
        id: 'multa', label: 'Ponerle una multa interna',
        resultado: [
          { prob: 0.7, nota: 'se corrige', efectos: { moral: 2, presion: -2 } },
          { prob: 0.3, nota: 'se resiente y baja el rendimiento', efectos: { moral: -6 } },
        ],
      },
      {
        id: 'hablar', label: 'Hablarlo en privado, sin sanción',
        resultado: [
          { prob: 0.6, nota: 'promete cambiar', efectos: { moral: 3 } },
          { prob: 0.4, nota: 'reincide en dos semanas', efectos: { moral: -4, ratingDelta: -1 } },
        ],
      },
    ],
  }),
  p('rumor_alineacion_filtrada', {
    tags: ['vestuario'],
    intensidad: INTENSIDAD.BAJA,
    titulo: 'Se filtró la alineación antes del partido',
    texto: 'Alguien del cuerpo técnico o del plantel contó el once a la prensa antes de que lo anunciaras vos. No sabés quién fue.',
    opciones: [
      {
        id: 'investigar', label: 'Investigar quién filtró',
        resultado: [
          { prob: 0.55, nota: 'lo encontrás', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'creás paranoia en el grupo', efectos: { moral: -5 } },
        ],
      },
      {
        id: 'ignorar', label: 'Dejarlo pasar esta vez',
        resultado: [
          { prob: 0.65, nota: 'se olvida', efectos: { presion: 1 } },
          { prob: 0.35, nota: 'vuelve a pasar en un partido importante', efectos: { presion: 8 } },
        ],
      },
    ],
  }),
  p('suplente_no_saluda', {
    tags: ['vestuario'],
    intensidad: INTENSIDAD.BAJA,
    titulo: 'Tensión silenciosa entre los arqueros',
    texto: 'Tu segundo arquero dejó de saludar al titular. Nadie dice nada en voz alta, pero todo el plantel lo nota en cada entrenamiento.',
    opciones: [
      {
        id: 'intervenir', label: 'Hablar con los dos para destrabarlo',
        resultado: [
          { prob: 0.7, nota: 'se resuelve', efectos: { moral: 3 } },
          { prob: 0.3, nota: 'pide salir en el próximo mercado', efectos: { moral: -2, presion: 2 } },
        ],
      },
      {
        id: 'dejar', label: 'Dejar que lo resuelvan solos',
        resultado: [
          { prob: 0.5, nota: 'se arregla', efectos: { moral: 1 } },
          { prob: 0.5, nota: 'escala', efectos: { moral: -5 } },
        ],
      },
    ],
  }),
  p('figura_redes_sociales', {
    tags: ['individual'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => !!c.figura,
    titulo: '{figura} subió una historia a las 3 de la mañana',
    texto: 'Se lo ve en un boliche, dos días antes del partido. Ya la vieron todos: hinchas, periodistas y compañeros de plantel.',
    opciones: [
      {
        id: 'llamar_retar', label: 'Llamarlo y retarlo en privado',
        resultado: [
          { prob: 0.65, nota: 'se disculpa y enfoca', efectos: { moral: 2, ratingDelta: 1 } },
          { prob: 0.35, nota: 'se ofende, baja el rendimiento', efectos: { moral: -6 } },
        ],
      },
      {
        id: 'ejemplo_publico', label: 'Usarlo como ejemplo frente al plantel',
        resultado: [
          { prob: 0.55, nota: 'el plantel toma nota', efectos: { moral: 3, presion: 2 } },
          { prob: 0.45, nota: 'lo vive como una traición', efectos: { moral: -7 } },
        ],
      },
    ],
  }),
  p('utilero_hablo_de_mas', {
    tags: ['dirigencia', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    titulo: 'El utilero habló con un periodista amigo',
    texto: 'Sin dar nombres, dijo que "hay problemas internos en el plantel". No hizo falta más que eso para que estalle la nota.',
    opciones: [
      {
        id: 'despedir', label: 'Despedirlo',
        resultado: [
          { prob: 0.7, nota: 'el mensaje queda claro', efectos: { presion: -3 } },
          { prob: 0.3, nota: 'el plantel lo ve como algo frío', efectos: { moral: -4 } },
        ],
      },
      {
        id: 'advertir', label: 'Advertirle y darle una segunda chance',
        resultado: [
          { prob: 0.6, nota: 'no vuelve a pasar', efectos: { presion: -1 } },
          { prob: 0.4, nota: 'el periodista ya tenía más info de antes', efectos: { presion: 6 } },
        ],
      },
    ],
  }),
];

/** Devuelve el paquete completo por id. Los ids siempre salen de este catálogo (o de la IA validada contra él). */
export function paquete(id) {
  const p = CATALOGO.find((x) => x.id === id);
  if (!p) throw new Error(`Paquete de evento "${id}" no existe en el catálogo`);
  return p;
}
