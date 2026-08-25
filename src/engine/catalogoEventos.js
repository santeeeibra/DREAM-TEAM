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
//
// SISTEMA DE FILTROS POR CONDICIÓN:
// Cada evento tiene un campo `filtro` que recibe el contexto del juego y devuelve true/false.
// El contexto incluye: { temporada, tramo, posicion, racha, moral, fatiga, presion, money, 
// figura, rival, plantel, once, ratingDelta, modificadorTramo }
//
// Ejemplos de filtros:
//   filtro: (c) => c.moral < 40              // Crisis de moral
//   filtro: (c) => c.racha === 'buena'       // Racha ganadora (últimos 5: >=11 pts)
//   filtro: (c) => c.racha === 'mala'        // Racha perdedora (últimos 5: <=4 pts)
//   filtro: (c) => c.presion >= 60           // Presión alta
//   filtro: (c) => c.money <= 10             // Caja baja
//   filtro: (c) => c.posicion <= 3           // Peleando arriba
//   filtro: (c) => c.temporada >= 3          // A partir de temp 3
//   filtro: (c) => !!c.figura && !!c.rival   // Requiere figura y rival
//   filtro: () => true                       // Siempre disponible (default)
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
    titulo: 'HAY UN TOPO: SE FILTRÓ EL EQUIPO',
    texto: 'Alguien de adentro le vendió el equipo a la prensa antes de la charla técnica. El vestuario está picado y no sabés quién fue el buchón.',
    opciones: [
      {
        id: 'cubrir', label: 'Buscar al responsable puertas adentro',
        resultado: [
          { prob: 0.6, nota: 'Apareció el buchón, lo cruzaste en la justa', efectos: { ratingDelta: 1, fatiga: 4, moral: -2 } },
          { prob: 0.4, nota: 'El vestuario quedó picado, nadie se fía de nadie', efectos: { ratingDelta: -3, presion: 15, moral: -8 }, tramo: { fuerza: -3 } },
        ],
      },
      {
        id: 'bajar', label: 'Bajarle la espuma al tema',
        resultado: [
          { prob: 0.7, nota: 'El grupo se metió de lleno en la semana, lo demás afuera', efectos: { moral: -8, ratingDelta: -1, fatiga: 2 } },
          { prob: 0.3, nota: 'Te comieron la mano, al clásico siguiente filtraron el once de vuelta', efectos: { moral: -12, ratingDelta: -1, presion: 12, fatiga: 4 } },
        ],
      },
    ],
  }),
  p('pelea_vestuario', {
    tags: ['vestuario'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.moral <= 50,
    titulo: 'EL VESTUARIO ESTÁ PICADO',
    texto: 'Dos titulares se agarraron a las piñas en el pasillo del vestuario después de la goleada. Los separó el utilero, pero la grieta quedó abierta. Cada uno te pide que eches al otro del grupo.',
    opciones: [
      {
        id: 'echar', label: 'Expulsar al detonante del conflicto',
        resultado: [
          { prob: 0.5, nota: 'los demás ven que el que la caga la paga, se calman', efectos: { moral: 6, ratingDelta: -3, fatiga: 2 } },
          { prob: 0.5, nota: 'el grupo se partió en dos, hay rencores para rato', efectos: { moral: -8, presion: 8, ratingDelta: -3, fatiga: 4 } },
        ],
      },
      {
        id: 'perdonar', label: 'Cerrar el conflicto sin expulsiones',
        resultado: [
          { prob: 0.6, nota: 'se dieron la mano, por ahora está tranquilo', efectos: { moral: 2, fatiga: -2, presion: -2 } },
          { prob: 0.4, nota: 'el odio sigue en los entrenamientos, se nota en cada pelota dividida', efectos: { moral: -10, presion: 6, fatiga: 4 } },
        ],
      },
    ],
  }),
  p('capitan_cuestiona_tactica', {
    tags: ['vestuario', 'prensa'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo >= 1,
    titulo: 'El capitán cuestionó tu esquema en la radio',
    texto: 'En una entrevista post-partido dijo que "hay jugadores incómodos con el sistema" y que "hay que ser honestos con la gente". La interpretación de la prensa fue un mazazo: te están descolgando en vivo.',
    opciones: [
      {
        id: 'confrontar', label: 'Bajar línea fuerte en el vestuario',
        resultado: [
          { prob: 0.7, nota: 'el capitán se tragó el discurso, no volvió a abrir la boca', efectos: { moral: 5, presion: -3 } },
          { prob: 0.3, nota: 'fue derecho al presidente, ahora el quilombo es institucional', efectos: { moral: -6, presion: 10 } },
        ],
      },
      {
        id: 'ignorar', label: 'Hablarlo a solas y escuchar su postura',
        resultado: [
          { prob: 0.55, nota: 'tiraron para el mismo lado, algo salió de la charla', efectos: { presion: -2 } },
          { prob: 0.45, nota: 'otros tres del plantel se prendieron, el murmullo se hizo ruido', efectos: { moral: -7, presion: 6 } },
        ],
      },
    ],
  }),
  p('idolo_quiere_retirarse', {
    tags: ['plantel', 'hinchada'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 3,
    titulo: 'Ídolo de plantel pide retirarse',
    texto: 'El capitán más querido del plantel se acercó a vos para decirte que esta es su última temporada. No rinde como antes, pero es símbolo y la hinchada lo exige. La dirigencia debe decidir si renovar o dejar ir.',
    opciones: [
      { id: 'firmar', label: 'Renovarlo por una temporada más', efectos: { presion: -10, moral: 12, ratingDelta: -2 } },
      {
        id: 'rechazar', label: 'Facilitar su retiro con dignidad',
        resultado: [
          { prob: 0.4, nota: 'la tribuna lo despidió con aplausos, no hubo drama', efectos: { presion: 2, moral: -3 } },
          { prob: 0.6, nota: 'te quemaron en redes, "echaron al ídolo" fue el hashtag del día', efectos: { presion: 20, moral: -8 } },
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
          { prob: 0.65, nota: 'apareció, habló con vos, está en carrera otra vez', efectos: { moral: 10, ratingDelta: 2 } },
          { prob: 0.35, nota: 'ni abrió la puerta, dos semanas mirando el teléfono sin respuesta', efectos: { moral: -3, fatiga: 5 } },
        ],
      },
      {
        id: 'baja', label: 'Darle la baja del plantel',
        resultado: [
          { prob: 0.5, nota: 'el plantel lo procesó, siguen para adelante sin drama', efectos: { moral: 3, presion: -4 } },
          { prob: 0.5, nota: 'quedaste como el DT de hielo, algunos no te lo van a perdonar', efectos: { moral: -9, presion: 6 } },
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
          { prob: 0.55, nota: 'el presidente se rajó, la venta se cayó', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'te pusieron la etiqueta de "difícil", ya circula en los pasillos', efectos: { presion: 18, moral: -3 } },
        ],
      },
      {
        id: 'negociar', label: 'Aceptar y negociar el reemplazo',
        resultado: [
          { prob: 0.6, nota: 'la plata cayó y el reemplazo enchufó rápido, salió bien', efectos: { money: 14, ratingDelta: -4 } },
          { prob: 0.4, nota: 'la plata en el banco, pero tres tramos sin el puesto cubierto', efectos: { money: 14, ratingDelta: -7 } },
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
          { prob: 0.7, nota: 'el plantel se quedó más tranquilo, foco en el partido', efectos: { moral: 6, presion: -6 } },
          { prob: 0.3, nota: 'alguien grabó la charla, salió en el diario peor que el comunicado', efectos: { moral: -8, presion: 10 } },
        ],
      },
      {
        id: 'silencio', label: 'Guardar silencio y seguir laburando',
        resultado: [
          { prob: 0.6, nota: 'otra noticia tapó todo, nadie se acuerda más', efectos: { presion: -3 } },
          { prob: 0.4, nota: 'sin desmentida el rumor creció, algunos jugadores llaman a sus agentes', efectos: { moral: -15, presion: 8 } },
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
          { prob: 0.65, nota: 'el pibe entró 20 minutos, no la tocó, pero el sponsor se calla la boca', efectos: { money: 7 } },
          { prob: 0.35, nota: 'Olé tituló "el DT pone al amigo del sponsor", quilombo mediático', efectos: { money: 7, presion: 10, moral: -4 } },
        ],
      },
      {
        id: 'negar', label: 'Plantarte: juega el que se lo gana',
        resultado: [
          { prob: 0.7, nota: 'el plantel te respeta más por no doblarte, eso no tiene precio', efectos: { moral: 5 } },
          { prob: 0.3, nota: 'el presidente te llamó a la oficina y la charla no terminó bien', efectos: { presion: 12, money: -2 } },
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
          { prob: 0.6, nota: 'el presidente te llamó esa misma tarde, contrato nuevo en la mesa', efectos: { moral: 10, presion: -8 } },
          { prob: 0.4, nota: 'te quedaste sin la oferta y sin la renovación, igual te la bancás', efectos: { moral: 10, presion: -2 } },
        ],
      },
      {
        id: 'negociar', label: 'Negociar en silencio tu renovación',
        resultado: [
          { prob: 0.55, nota: 'usaste la oferta de palanca y te subieron el sueldo', efectos: { money: -3, moral: 4 } },
          { prob: 0.45, nota: 'se enteraron todos, mitad del plantel cree que te vas', efectos: { moral: -9, presion: 8 } },
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
          { prob: 0.7, nota: 'nadie más supo, se esfumó como llegó', efectos: { presion: -5, moral: 5 } },
          { prob: 0.3, nota: 'la investigación llegó igual a tu nombre, necesitás un abogado', efectos: { presion: 10, moral: 5 } },
        ],
      },
      {
        id: 'ignorar', label: 'Ignorarlo sin decir nada',
        resultado: [
          { prob: 0.8, nota: 'pasó de largo sin dejar rastro, por ahora', efectos: {} },
          { prob: 0.2, nota: 'tu número apareció en el expediente, carrera en riesgo', efectos: { presion: 30, moral: -15 } },
        ],
      },
      {
        id: 'agarrar', label: 'Agarrar la valija',
        resultado: [
          { prob: 0.2, nota: 'los pesos cayeron limpios, por ahora nadie sabe nada', efectos: { money: 50, ratingDelta: 3 } },
          { prob: 0.8, nota: 'la AFA te suspendió de por vida, carrera terminada', efectos: { presion: 100 } },
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
          { prob: 0.55, nota: 'la CAS le dio la razón, suplemento sin culpa confirmado', efectos: { moral: 6, presion: -4 } },
          { prob: 0.45, nota: 'la causa se amplió al club, el logo apareció en todos los medios', efectos: { presion: 18, moral: -6 } },
        ],
      },
      {
        id: 'distanciarte', label: 'Tomar distancia y proteger al club',
        resultado: [
          { prob: 0.7, nota: 'aceptó quedarse afuera, entiende que es lo mejor para el club', efectos: { presion: -8 } },
          { prob: 0.3, nota: 'se cortó todo lazo, en el próximo mercado te lo ponen enfrente', efectos: { moral: -10, presion: -8 } },
        ],
      },
    ],
  }),
  p('figura_pide_mas_plata', {
    tags: ['individual', 'mercado'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.temporada >= 2,
    titulo: '{figura} demanda aumento salarial',
    texto: 'El jugador demanda duplicar su sueldo o se irá libre al finalizar el contrato. El club no tiene ese presupuesto y te enteraste a través de la prensa.',
    opciones: [
      {
        id: 'pedir_fondos', label: 'Solicitarle aumento salarial al presidente',
        resultado: [
          { prob: 0.5, nota: 'el presidente encontró la plata, la firma se hizo esa semana', efectos: { money: -8, moral: 6 } },
          { prob: 0.5, nota: 'la directiva fue clara: si no firma así, en enero se fue', efectos: { presion: 10, moral: -4 } },
        ],
      },
      {
        id: 'hablar_proyecto', label: 'Gestionar su continuidad en el club',
        resultado: [
          { prob: 0.6, nota: 'le vendiste el proyecto y se quedó, por ahora', efectos: { moral: 5 } },
          { prob: 0.4, nota: 'se fue libre al clásico rival, la foto salió en primera plana', efectos: { money: 10, ratingDelta: -5, moral: -6 } },
        ],
      },
    ],
  }),
  p('lesion_ocultada', {
    tags: ['individual'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.tramo >= 2,
    titulo: '{figura} oculta su condición física',
    texto: 'Después de la derrota, el jugador confesó que sintió un tirón en la entrada en calor pero prefirió no decir nada para poder jugar el próximo partido. Te pide que no lo expongas ante el cuerpo médico.',
    opciones: [
      {
        id: 'cubrir', label: 'Cubrirlo frente al cuerpo médico',
        resultado: [
          { prob: 0.65, nota: 'los compañeros lo ven como un guerrero, se ganó el respeto', efectos: { moral: 5 } },
          { prob: 0.35, nota: 'el médico rival lo vio cojear y la nota salió esa misma noche', efectos: { presion: 10, moral: -3 } },
        ],
      },
      {
        id: 'honesto', label: 'Sé honesto con el cuerpo médico',
        resultado: [
          { prob: 0.55, nota: 'el cuerpo médico lo trató sin dramas, hiciste lo correcto', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'se sintió traicionado, en el vestuario dejó de saludarte', efectos: { moral: -10 } },
        ],
      },
    ],
  }),
  p('juvenil_pide_prestamo', {
    tags: ['juveniles'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Tu juvenil sin minutos busca salida',
    texto: 'El juvenil de 19 años no consigue minutos y un club extranjero quiere quedárselo a préstamo por seis meses. Vos lo necesitás como recambio, pero arriesgás perderlo.',
    opciones: [
      {
        id: 'dejar_ir', label: 'Dejarlo ir a préstamo',
        resultado: [
          { prob: 0.7, nota: 'volvió con otra cabeza, seis meses afuera lo hicieron crecer', efectos: { moral: 4, ratingDelta: 1 } },
          { prob: 0.3, nota: 'lo compraron antes de volver, te enteraste por la prensa', efectos: { money: -2, ratingDelta: -1 } },
        ],
      },
      {
        id: 'retener', label: 'Retenerlo para el proyecto',
        resultado: [
          { prob: 0.55, nota: 'cada vez que entró la clavó, te felicitaste por quedártelo', efectos: { ratingDelta: 2, moral: 2 } },
          { prob: 0.45, nota: 'se apagó, empezó a entrenar solo y tarde', efectos: { moral: -5 } },
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
          { prob: 0.6, nota: 'los medios salieron a bancarte, le tiraron la culpa a la selección', efectos: { moral: 5, presion: -3 } },
          { prob: 0.4, nota: 'en la federación te tienen de punto, cualquier cosa te la cobran', efectos: { presion: 8 } },
        ],
      },
      {
        id: 'callarte', label: 'No decir nada y adaptarte',
        resultado: [
          { prob: 0.7, nota: 'zafaste sin hacer ruido, el jugador también te lo valora', efectos: { presion: -4 } },
          { prob: 0.3, nota: 'en el vestuario quedó la sensación de que el DT no pelea por ellos', efectos: { moral: -8 } },
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
    filtro: (c) => !!c.figura && (c.moral <= 55 || c.racha === 'mala'),
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
    filtro: (c) => !!c.rival && c.tramo >= 4 && c.posicion <= 5 && c.racha !== 'mala',
    titulo: 'Tenés una final y una idea arriesgada',
    texto: 'El análisis dice que una formación experimental te da más chances contra {rival}. Todos esperan que juegues como siempre.',
    opciones: [
      {
        id: 'arriesgar', label: 'Arriesgar con la formación experimental',
        resultado: [
          { prob: 0.45, nota: 'la prensa habló de obra maestra táctica, el plantel te levantó en hombros', efectos: { moral: 8 }, tramo: { fuerza: 5 } },
          { prob: 0.55, nota: 'perdiste y la formación fue la noticia, te crucificaron en todos lados', efectos: { presion: 15, moral: -8 }, tramo: { fuerza: -4 } },
        ],
      },
      {
        id: 'conservador', label: 'Ir con lo conocido y conservador',
        resultado: [
          { prob: 0.65, nota: 'partido digno, sin brillar ni caer, se suma y listo', efectos: { presion: -2 }, tramo: { fuerza: 1 } },
          { prob: 0.35, nota: 'ganaste pero todos hablaban de otra cosa al día siguiente', efectos: { moral: -3 }, tramo: { fuerza: 1 } },
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
          { prob: 0.7, nota: 'agarró el mensaje, en la siguiente semana llegó antes que nadie', efectos: { moral: 2, presion: -2 } },
          { prob: 0.3, nota: 'la multa lo encendió, en el entrenamiento no tocó una pelota', efectos: { moral: -6 } },
        ],
      },
      {
        id: 'hablar', label: 'Hablarlo en privado, sin sanción',
        resultado: [
          { prob: 0.6, nota: 'prometió de palabra, veremos si esta vez cumple', efectos: { moral: 3 } },
          { prob: 0.4, nota: 'dos semanas después llegó tarde otra vez, el plantel ya lo miraba mal', efectos: { moral: -4, ratingDelta: -1 } },
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
          { prob: 0.55, nota: 'el buchón apareció, conversación breve y directa, asunto cerrado', efectos: { presion: -4 } },
          { prob: 0.45, nota: 'nadie habla con nadie, el vestuario quedó frío como un freezer', efectos: { moral: -5 } },
        ],
      },
      {
        id: 'ignorar', label: 'Dejarlo pasar esta vez',
        resultado: [
          { prob: 0.65, nota: 'la nota duró una hora, otra noticia lo tapó', efectos: { presion: 1 } },
          { prob: 0.35, nota: 'en el clásico ya sabían el once antes que los propios titulares', efectos: { presion: 8 } },
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
          { prob: 0.7, nota: 'se dieron la mano en el vestuario, drama terminado', efectos: { moral: 3 } },
          { prob: 0.3, nota: 'el suplente mandó al representante: no se queda para la próxima', efectos: { moral: -2, presion: 2 } },
        ],
      },
      {
        id: 'dejar', label: 'Dejar que lo resuelvan solos',
        resultado: [
          { prob: 0.5, nota: 'se hablan solos, vos no te gastaste en el medio', efectos: { moral: 1 } },
          { prob: 0.5, nota: 'explotó en el entrenamiento, todo el plantel se enteró', efectos: { moral: -5 } },
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
          { prob: 0.65, nota: 'pidió perdón en privado, entrenó a la par esa misma tarde', efectos: { moral: 2, ratingDelta: 1 } },
          { prob: 0.35, nota: 'se lo tomó a mal, esa semana entrenó con desgano total', efectos: { moral: -6 } },
        ],
      },
      {
        id: 'ejemplo_publico', label: 'Usarlo como ejemplo frente al plantel',
        resultado: [
          { prob: 0.55, nota: 'el vestuario entendió que esas cosas se pagan, nadie más se animó', efectos: { moral: 3, presion: 2 } },
          { prob: 0.45, nota: 'se sintió expuesto públicamente, en el vestuario dejó de saludarte', efectos: { moral: -7 } },
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
          { prob: 0.7, nota: 'el plantel entendió que hay cosas que no se hablan afuera', efectos: { presion: -3 } },
          { prob: 0.3, nota: 'algunos jugadores lo conocían de años, quedó un clima raro', efectos: { moral: -4 } },
        ],
      },
      {
        id: 'advertir', label: 'Advertirle y darle una segunda chance',
        resultado: [
          { prob: 0.6, nota: 'el susto lo silenció para rato, cerró la boca', efectos: { presion: -1 } },
          { prob: 0.4, nota: 'había más info guardada, al día siguiente salió todo junto', efectos: { presion: 6 } },
        ],
      },
    ],
  }),

  // ══════════════════════ FAMILIA: JUVENILES / CANTERA ══════════════════════
  p('pibe_debut_pide_titular', {
    tags: ['individual', 'plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.temporada >= 1,
    titulo: 'El pibe de reserva quiere ser titular',
    texto: 'Metió tres goles en cuatro partidos de reserva y su representante llamó: o juega el fin de semana o pide salir a préstamo. Tiene 18 años.',
    opciones: [
      { id: 'titular', label: 'Ponerlo de titular', resultado: [
        { prob: 0.5, nota: 'metió dos y asistió una, mañana ya está en el once fijo', efectos: { moral: 6, ratingDelta: 2 } },
        { prob: 0.5, nota: 'le temblaron las piernas, el estadio lo notó antes que él', efectos: { moral: -4, ratingDelta: -2, presion: 6 } },
      ]},
      { id: 'banco', label: 'Que sume desde el banco', efectos: { moral: -2, presion: 2 } },
    ],
  }),
  p('juvenil_convocado_seleccion', {
    tags: ['individual', 'plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo >= 2,
    titulo: '{figura} convocado a la Sub-20',
    texto: 'Se lo lleva el seleccionador juvenil por dos semanas. Vas a perderlo para el próximo tramo, pero volver "internacional" le va a cambiar la cabeza.',
    opciones: [
      { id: 'ceder', label: 'Cederlo sin trabas', efectos: { moral: 4, ratingDelta: -1, fatiga: 6 } },
      { id: 'pelear', label: 'Pedir que no lo lleven', resultado: [
        { prob: 0.4, nota: 'la selección cedió, el chico se queda con vos', efectos: { ratingDelta: 1, moral: -3 } },
        { prob: 0.6, nota: 'se lo llevaron igual, el seleccionador no te atendió el teléfono', efectos: { moral: -8, presion: 6 } },
      ]},
    ],
  }),

  // ══════════════════════ FAMILIA: PRENSA / RUEDAS DE PRENSA ══════════════════════
  p('pregunta_dificil_conferencia', {
    tags: ['dt', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: () => true,
    titulo: 'La pregunta trampa en conferencia',
    texto: 'El periodista de siempre te lanzó una pregunta cargada sobre el DT rival, buscando titular. Toda la sala espera.',
    opciones: [
      { id: 'chicana', label: 'Devolver con una chicana', resultado: [
        { prob: 0.5, nota: 'el clip se viralizó en Twitter, la tribuna te hizo tendencia', efectos: { moral: 5, presion: -3 } },
        { prob: 0.5, nota: 'el rival salió a contestarte en sus redes, se armó el bardo mediático', efectos: { presion: 12, moral: 2 } },
      ]},
      { id: 'diplomacia', label: 'Salida diplomática', efectos: { presion: -4 } },
    ],
  }),
  p('racha_ganadora_prensa', {
    tags: ['dt', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.racha === 'buena',
    titulo: 'Te comparan con los grandes',
    texto: 'Después de cinco fechas invicto, los medios te pusieron en la conversación de los mejores técnicos de la liga. El capitán te pregunta si esto te cambia la cabeza.',
    opciones: [
      { id: 'humilde', label: 'Mantener los pies en la tierra', efectos: { moral: 4, presion: -2 } },
      { id: 'aprovechar', label: 'Aprovechar el momento mediático', resultado: [
        { prob: 0.6, nota: 'el vestuario lo tomó como un reconocimiento propio, el grupo voló', efectos: { presion: -5, moral: 3 } },
        { prob: 0.4, nota: 'la primera derrota que vino fue el titular de todos los diarios', efectos: { presion: 12, moral: -2 } },
      ]},
    ],
  }),
  p('crisis_resultados', {
    tags: ['dt', 'plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.racha === 'mala' && c.presion >= 40,
    titulo: 'El plantel está contra las cuerdas',
    texto: 'Cuatro fechas sin ganar y la tribuna ya silba. En el vestuario nadie te mira a los ojos. El presidente te citó para mañana.',
    opciones: [
      { id: 'charla_dura', label: 'Reunión dura con el plantel', resultado: [
        { prob: 0.55, nota: 'el vestuario salió respondido, la charla dura valió la pena', efectos: { moral: 8, presion: -6 } },
        { prob: 0.45, nota: 'la reunión terminó con portazos, el bardo se complicó más', efectos: { moral: -10, presion: 8 } },
      ]},
      { id: 'descanso', label: 'Darles un día libre para resetear', efectos: { moral: 5, fatiga: -8, presion: 3 } },
    ],
  }),
  p('elogio_publico_rival', {
    tags: ['dt', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => !!c.rival && c.racha !== 'mala',
    titulo: 'El DT de {rival} te elogió en la previa',
    texto: 'Dijo que sos "de lo mejor que dio esta liga en años". Puede ser sincero o puede ser una jugada para relajarte antes del partido.',
    opciones: [
      { id: 'devolver', label: 'Devolver el elogio', efectos: { moral: 3, presion: -2 } },
      { id: 'ignorar', label: 'Enfocarse en el partido', efectos: { ratingDelta: 1 } },
    ],
  }),
  p('invicto_largo', {
    tags: ['dt', 'hinchada'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.racha === 'buena' && c.posicion <= 5,
    titulo: 'Invicto y arriba en la tabla',
    texto: 'Llevás más de un mes sin perder y el equipo está prendido en la pelea. La hinchada canta tu nombre, pero sabés que una derrota puede cambiar todo.',
    opciones: [
      { id: 'disfrutar', label: 'Disfrutar el momento con el plantel', efectos: { moral: 8, presion: -4, fatiga: 3 } },
      { id: 'mantener_foco', label: 'Mantener el foco y la humildad', efectos: { moral: 3, presion: -2, ratingDelta: 1 } },
    ],
  }),
  p('critica_ex_jugador', {
    tags: ['dt', 'prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.temporada >= 2 && (c.racha === 'mala' || c.presion >= 35),
    titulo: 'Un ex ídolo del club te criticó',
    texto: 'En su columna semanal dice que "el equipo no tiene alma" y que vos no entendés al club. Los hinchas lo respetan mucho.',
    opciones: [
      { id: 'responder', label: 'Responderle en conferencia', resultado: [
        { prob: 0.5, nota: 'los hinchas te respetaron más, la prensa habló de personalidad', efectos: { moral: 4, presion: 5 } },
        { prob: 0.5, nota: 'te cruzaron por todos lados, "se peleó con el ídolo" fue el titular', efectos: { moral: -4, presion: 10 } },
      ]},
      { id: 'callar', label: 'No contestar', efectos: { presion: 4 } },
    ],
  }),
  p('exigencia_hinchada_titulo', {
    tags: ['hinchada', 'prensa'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.racha === 'buena' && c.posicion <= 3 && c.temporada >= 2,
    titulo: 'La hinchada ya habla de título',
    texto: 'Después de tantas fechas ganando, la tribuna canta "campeón" en cada partido. Algunos jugadores te preguntan si es momento de plantearse ganar la liga.',
    opciones: [
      { id: 'abrazar_presion', label: 'Abrazar la presión del título', efectos: { moral: 10, presion: 15, ratingDelta: 2 } },
      { id: 'partido_partido', label: 'Seguir partido a partido', efectos: { moral: 5, presion: -3 } },
    ],
  }),

  // ══════════════════════ FAMILIA: MERCADO / FICHAJES ══════════════════════
  p('representante_ofrece_veterano', {
    tags: ['plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo <= 1,
    titulo: 'Ofrecen un nombre grande, pero al límite',
    texto: 'Un representante te ofrece un ex-crack europeo. Tiene 34, contrato caro, pero sabe ganar finales.',
    opciones: [
      { id: 'firmar', label: 'Firmarlo', resultado: [
        { prob: 0.5, nota: 'cada charla de vestuario vale oro, el plantel lo escucha como a nadie', efectos: { ratingDelta: 2, moral: 6, money: -3 } },
        { prob: 0.5, nota: 'duró tres semanas, el isquiotibial no lo perdonó', efectos: { moral: -4, money: -3 } },
      ]},
      { id: 'descartar', label: 'No es para nosotros', efectos: {} },
    ],
  }),
  p('rival_intenta_robar_asistente', {
    tags: ['institucional'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Un rival directo quiere a tu ayudante',
    texto: 'Te avisa el propio ayudante: le ofrecieron el puesto de DT en otro club de la liga. Quiere quedarse pero también quiere una respuesta.',
    opciones: [
      { id: 'retener', label: 'Retenerlo con más sueldo', efectos: { money: -4, moral: 4, presion: -3 } },
      { id: 'dejarir', label: 'Dejarlo ir con la bendición', resultado: [
        { prob: 0.55, nota: 'el nuevo entró enchufado, casi no se notó el cambio', efectos: { moral: -3 } },
        { prob: 0.45, nota: 'lo extrañaban en cada entrenamiento, era el pegamento del cuerpo técnico', efectos: { moral: -8, ratingDelta: -1 } },
      ]},
    ],
  }),
  p('canje_por_delantero', {
    tags: ['plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo <= 2,
    titulo: 'Proponen un canje uno por uno',
    texto: 'Un club te ofrece cambiar un central tuyo por un delantero suyo. Es plata cero, todo trueque.',
    opciones: [
      { id: 'aceptar', label: 'Aceptar el canje', resultado: [
        { prob: 0.5, nota: 'los dos cambiaron de chip, el canje fue un 10 para ambos lados', efectos: { ratingDelta: 1, moral: 3 } },
        { prob: 0.5, nota: 'el que mandaste metió un hat-trick en su debut, no te lo van a dejar olvidar', efectos: { presion: 8, moral: -5 } },
      ]},
      { id: 'rechazar', label: 'Rechazarlo', efectos: {} },
    ],
  }),

  // ══════════════════════ FAMILIA: HINCHADA / TRIBUNA ══════════════════════
  p('barra_pide_reunion', {
    tags: ['hinchada'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.presion >= 45,
    titulo: 'La barra quiere una reunión',
    texto: 'Los jefes de la hinchada organizada piden verte "de igual a igual" en el predio. No es una amenaza abierta, pero tampoco es una charla amistosa.',
    opciones: [
      { id: 'recibir', label: 'Recibirlos y escuchar', resultado: [
        { prob: 0.55, nota: 'escucharon, dijeron lo suyo y se fueron, por ahora quieto', efectos: { presion: -8 } },
        { prob: 0.45, nota: 'alguien los fotografió entrando al predio, la nota salió antes del almuerzo', efectos: { presion: 15, moral: -4 } },
      ]},
      { id: 'negar', label: 'Negarse a recibirlos', efectos: { presion: 10 } },
    ],
  }),
  p('banderazo_apoyo', {
    tags: ['hinchada'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.presion >= 55 || c.racha === 'mala',
    titulo: 'Banderazo antes del partido',
    texto: 'Miles de hinchas fueron al hotel de concentración con banderas y bombos. Se te pusieron la carne de gallina mirándolo por la ventana.',
    opciones: [
      { id: 'salir', label: 'Salir a saludar', efectos: { moral: 10, presion: -6, fatiga: 2 } },
      { id: 'concentracion', label: 'Mantener la concentración', efectos: { ratingDelta: 1, moral: 3 } },
    ],
  }),
  p('silbatina_titular', {
    tags: ['hinchada', 'individual'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.presion >= 40,
    titulo: 'La hinchada silbó a {figura}',
    texto: 'Cada vez que tocaba la pelota, una parte de la tribuna silbaba. El jugador terminó llorando en el vestuario.',
    opciones: [
      { id: 'bancar', label: 'Bancarlo públicamente', efectos: { moral: 6, presion: 8, ratingDelta: 1 } },
      { id: 'suplente', label: 'Mandarlo al banco un tramo', resultado: [
        { prob: 0.55, nota: 'sin la presión del estadio se reencontró, volvió con confianza', efectos: { presion: -6, moral: -3 } },
        { prob: 0.45, nota: 'se lo tomó como una puñalada, la relación quedó rota', efectos: { moral: -8, ratingDelta: -2 } },
      ]},
    ],
  }),

  // ══════════════════════ FAMILIA: ÁRBITRO / VAR ══════════════════════
  p('penal_dudoso_ultimo_minuto', {
    tags: ['prensa'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.tramo >= 1,
    titulo: 'Penal dudoso en el último minuto',
    texto: 'El VAR se demoró seis minutos revisando la jugada. El árbitro cobró y perdiste dos puntos. Todos esperan tu reacción.',
    opciones: [
      { id: 'estallar', label: 'Estallar en conferencia', resultado: [
        { prob: 0.5, nota: 'la tribuna te cantó hasta en los pasillos, sos el DT del pueblo', efectos: { moral: 6, presion: -4 } },
        { prob: 0.5, nota: 'la AFA te revisó cada palabra, la multa llegó en tres días', efectos: { money: -5, presion: 4 } },
      ]},
      { id: 'mesura', label: 'Ser mesurado', efectos: { presion: 2 } },
    ],
  }),
  p('denuncia_arbitraje_temporada', {
    tags: ['dt', 'prensa'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.temporada >= 2 && c.presion >= 55,
    titulo: 'Los arbitrajes de la temporada',
    texto: 'Un canal armó un informe con todos los fallos dudosos que sufriste. Te preguntan si vas a hacer una denuncia formal.',
    opciones: [
      { id: 'denunciar', label: 'Presentar la denuncia', resultado: [
        { prob: 0.35, nota: 'el informe prosperó, suspendieron al árbitro preventivamente', efectos: { moral: 8, presion: -8 } },
        { prob: 0.65, nota: 'la sanción llegó rápido: dos fechas en la tribuna mirando', efectos: { moral: -5, presion: 12, ratingDelta: -2 } },
      ]},
      { id: 'archivar', label: 'Archivar el tema', efectos: { presion: 4 } },
    ],
  }),

  // ══════════════════════ FAMILIA: CUERPO TÉCNICO / MÉDICO ══════════════════════
  p('preparador_fisico_renuncia', {
    tags: ['institucional'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.fatiga >= 55,
    titulo: 'El preparador físico renuncia',
    texto: 'Se cansó del rejunte de lesiones y de que el cuerpo médico lo culpe. Presentó la renuncia a la mañana.',
    opciones: [
      { id: 'aceptar', label: 'Aceptarla y traer otro', resultado: [
        { prob: 0.5, nota: 'el nuevo trajo una metodología diferente, el plantel lo adoptó rápido', efectos: { fatiga: -8, money: -3 } },
        { prob: 0.5, nota: 'el nuevo no terminó de conectar, el plantel siguió cargado igual', efectos: { fatiga: 5, ratingDelta: -1, money: -3 } },
      ]},
      { id: 'retener', label: 'Bajar los brazos y retenerlo', efectos: { presion: 3, moral: 2 } },
    ],
  }),
  p('cuerpo_medico_alerta_carga', {
    tags: ['plantel'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.fatiga >= 60,
    titulo: 'Alerta del cuerpo médico',
    texto: 'Te muestran los datos GPS: tres titulares están al 92% de carga. Si seguís así, alguno se rompe seguro.',
    opciones: [
      { id: 'rotar', label: 'Rotar el próximo tramo', efectos: { fatiga: -10, ratingDelta: -2 } },
      { id: 'apretar', label: 'Apretar los dientes', resultado: [
        { prob: 0.45, nota: 'los tres llegaron enteros, el físico respondió cuando más importaba', efectos: { fatiga: 5 } },
        { prob: 0.55, nota: 'uno cayó en el calentamiento, el cuerpo médico lo confirmó: fuera dos semanas', efectos: { fatiga: 8, moral: -6, ratingDelta: -3 } },
      ]},
    ],
  }),

  // ══════════════════════ FAMILIA: TÁCTICA / ENTRENAMIENTO ══════════════════════
  p('cambio_de_esquema', {
    tags: ['dt', 'plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo >= 2,
    titulo: 'Probar un esquema nuevo',
    texto: 'Tu ayudante insiste con cambiar a línea de 3 en el fondo. El plantel nunca lo entrenó en serio.',
    opciones: [
      { id: 'probar', label: 'Meterlo en el próximo partido', resultado: [
        { prob: 0.45, nota: 'el rival no supo cómo marcarte, ganaron con autoridad', efectos: { ratingDelta: 3, moral: 5 } },
        { prob: 0.55, nota: 'tres toques y ya la perdían, el plantel no entendió nada', efectos: { ratingDelta: -3, moral: -5, presion: 6 } },
      ]},
      { id: 'esperar', label: 'Entrenarlo tres semanas primero', efectos: { fatiga: 4 } },
    ],
  }),
  p('doble_turno_semanal', {
    tags: ['dt', 'plantel'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => c.tramo >= 1 && c.tramo <= 4,
    titulo: 'Meter doble turno esta semana',
    texto: 'Venís de un empate y sentís que hay que apretar. El referente del vestuario ya vino a pedirte que no.',
    opciones: [
      { id: 'doble', label: 'Doble turno igual', efectos: { fatiga: 10, ratingDelta: 2, moral: -3 } },
      { id: 'escuchar', label: 'Escuchar al referente', efectos: { moral: 4, ratingDelta: -1 } },
    ],
  }),
  p('pelota_parada_ensayo', {
    tags: ['dt'],
    intensidad: INTENSIDAD.BAJA,
    filtro: () => true,
    titulo: 'Ensayo de pelota parada',
    texto: 'Cortás el entrenamiento entero para trabajar solo córners y tiros libres. Los jugadores se aburren, pero puede pagar en un partido cerrado.',
    opciones: [
      { id: 'insistir', label: 'Insistir toda la semana', efectos: { ratingDelta: 2, moral: -2 } },
      { id: 'variar', label: 'Meter juegos también', efectos: { moral: 3, fatiga: -2 } },
    ],
  }),

  // ══════════════════════ FAMILIA: INSTITUCIONAL / FUERA DE CANCHA ══════════════════════
  p('deuda_sueldos_plantel', {
    tags: ['institucional', 'plantel'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.money <= 6,
    titulo: 'Se atrasaron los sueldos del plantel',
    texto: 'La directiva no pagó a tiempo. El capitán vino a decirte que si no se soluciona esta semana, no entrenan el jueves.',
    opciones: [
      { id: 'poner_cara', label: 'Ponerte del lado del plantel', resultado: [
        { prob: 0.55, nota: 'la directiva cedió, los sueldos cayeron esa misma tarde', efectos: { moral: 8, presion: 8, money: -3 } },
        { prob: 0.45, nota: 'te dejaron solo en el barro, la plata no llegó y vos quedaste en el medio', efectos: { presion: 18, moral: 4 } },
      ]},
      { id: 'mediar', label: 'Mediar entre las partes', efectos: { presion: 4, moral: -3 } },
    ],
  }),
  p('inauguracion_estadio_reformado', {
    tags: ['institucional', 'hinchada'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.tramo === 0,
    titulo: 'Se reinaugura el estadio',
    texto: 'La obra terminó justo para el próximo partido. Va a estar lleno, con banda en vivo y jugadores históricos en la previa. Y toda la presión.',
    opciones: [
      { id: 'motivar', label: 'Usarlo para motivar', efectos: { moral: 8, presion: 6, ratingDelta: 1 } },
      { id: 'desactivar', label: 'Bajar la ansiedad del plantel', efectos: { presion: -4, moral: 3 } },
    ],
  }),
  p('documental_backstage', {
    tags: ['institucional', 'plantel'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.temporada >= 2,
    titulo: 'Una plataforma quiere hacer un documental',
    texto: 'Ofrecen buena plata por seguir al plantel con cámaras adentro del vestuario durante toda la temporada. El plantel está dividido.',
    opciones: [
      { id: 'aceptar', label: 'Aceptar el contrato', resultado: [
        { prob: 0.45, nota: 'la plataforma armó un trailer que se viralizó, el club ganó visibilidad', efectos: { money: 10, presion: 6 } },
        { prob: 0.55, nota: 'las cámaras agarraron una discusión que nadie quería publicar', efectos: { money: 10, moral: -8, presion: 15 } },
      ]},
      { id: 'rechazar', label: 'Rechazarlo', efectos: { moral: 3 } },
    ],
  }),

  // ══════════════════════ FAMILIA: GRAVE (modo difícil) ══════════════════════
  // Eventos forzados sin elección A/B: el DT solo puede confirmar.
  // No pasan por IA ni por sorteo con candidatos — el motor los fija directo.
  // Los efectos son fijos (no se escalan por PRESION_DIFICIL).
  p('lesion_grave', {
    tags: ['individual'],
    grave: true,
    requiereReemplazo: true,
    intensidad: INTENSIDAD.MEDIA,
    filtro: () => true,
    titulo: 'Lesión de 3 semanas',
    texto: 'El cuerpo médico confirmó lo peor: entre 3 y 4 semanas fuera. Es una baja segura para el próximo tramo y no hay forma de acelerarlo. Tenés que reorganizar el once.',
    opciones: [{ id: 'continuar', label: 'Reorganizar el once', efectos: { moral: -4, fatiga: 2 } }],
  }),
  p('lesion_figura_prePartido', {
    tags: ['individual'],
    grave: true,
    requiereReemplazo: true,
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => c.fatiga >= 65,
    titulo: 'Baja de último momento',
    texto: 'Un titular se resintió de una sobrecarga muscular en el entrenamiento de la mañana. El cuerpo médico lo descartó para el próximo partido. No hay vuelta atrás: tenés que cubrir la baja.',
    opciones: [{ id: 'continuar', label: 'Continuar', efectos: { moral: -30 } }],
  }),
  p('suspension_figura_prePartido', {
    tags: ['individual'],
    grave: true,
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura,
    titulo: 'Suspensión por acumulación',
    texto: '{figura} llega a la quinta amarilla con el peor timing posible. Se pierde el partido y el banco completo. No hay apelación — el reglamento es el reglamento.',
    opciones: [{ id: 'continuar', label: 'Continuar', efectos: { moral: -20, presion: 10 } }],
  }),
  p('lesion_jugador_normal', {
    tags: ['vestuario'],
    grave: true,
    intensidad: INTENSIDAD.BAJA,
    filtro: () => true,
    titulo: 'Baja en el plantel',
    texto: 'Uno de los jugadores del banco se torció el tobillo en los últimos metros del entrenamiento. No es titular indiscutido, pero deja el plantel más corto para lo que viene.',
    opciones: [{ id: 'continuar', label: 'Continuar', efectos: { moral: -20, fatiga: 5 } }],
  }),
  p('ultimatum_directiva', {
    tags: ['institucional'],
    grave: true,
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => c.presion >= 50,
    titulo: 'Ultimátum de la directiva',
    texto: 'El presidente del club te citó a su despacho. El mensaje fue breve y sin rodeos: los próximos resultados van a determinar si hay o no hay continuidad. No hay negociación.',
    opciones: [{ id: 'continuar', label: 'Entendido', efectos: { presion: 15, moral: -10 } }],
  }),

  // ══════════════════════ FAMILIA: DIÁLOGOS CON EL DT (estilo FIFA/EA FC) ══════════════════════
  p('dialogo_pide_titularidad', {
    tags: ['individual', 'vestuario'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.moral >= 60,
    titulo: 'Charla en el vestuario',
    texto: '{figura} te pide una charla después del entrenamiento. "Mister, siento que estoy en un gran momento y puedo aportar mucho más al equipo. Me gustaría tener más continuidad en el once titular."',
    opciones: [
      {
        id: 'promete_titular',
        label: 'Le prometo titularidad',
        resultado: [
          { prob: 70, efectos: { moral: 6, fatiga: -3 }, texto: 'Se fue motivado. La confianza lo levantó.' },
          { prob: 30, efectos: { presion: 5 }, texto: 'Otros jugadores reclaman lo mismo. El vestuario está picante.' },
        ],
      },
      {
        id: 'mantiene_rotacion',
        label: 'La rotación es innegociable',
        resultado: [
          { prob: 60, efectos: { moral: -4, fatiga: 2 }, texto: 'Se fue con cara larga pero no hubo quilombo.' },
          { prob: 40, efectos: { moral: -8, presion: 8 }, texto: 'Se calentó. Ahora lo tenés en contra.' },
        ],
      },
    ],
  }),

  p('dialogo_banco_caliente', {
    tags: ['individual', 'vestuario'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.moral < 50,
    titulo: 'Tensión en el banco',
    texto: '{figura} está al límite. "No entiendo por qué no juego. Necesito minutos o me voy a plantear otras opciones." El tono no es de pedido, es de ultimátum.',
    opciones: [
      {
        id: 'calma_promesa',
        label: 'Lo calmo y le prometo cambios',
        resultado: [
          { prob: 50, efectos: { moral: 4, presion: -3 }, texto: 'Se bajó del catre. Por ahora.' },
          { prob: 50, efectos: { presion: 10 }, texto: 'No le creyó. La situación empeoró.' },
        ],
      },
      {
        id: 'confronta_duro',
        label: 'Acá se juega lo que yo digo',
        resultado: [
          { prob: 40, efectos: { moral: -10, presion: 5 }, texto: 'Se pudrió todo. El vestuario está dividido.' },
          { prob: 60, efectos: { moral: 3 }, texto: 'El resto del plantel te bancó. Ganaste autoridad.' },
        ],
      },
    ],
  }),

  p('dialogo_felicitacion', {
    tags: ['individual', 'vestuario'],
    intensidad: INTENSIDAD.BAJA,
    filtro: (c) => !!c.figura && c.racha === 'buena' && c.moral >= 70,
    titulo: 'El capitán te busca',
    texto: '{figura} te frena en el pasillo. "Mister, el grupo está re bien. Seguimos así y vamos a hacer historia este año. Gracias por confiar en nosotros."',
    opciones: [
      {
        id: 'motiva_mas',
        label: 'Esto recién empieza',
        efectos: { moral: 5, fatiga: -2 },
      },
      {
        id: 'mantiene_pies_tierra',
        label: 'Sin relajarse, falta mucho',
        efectos: { moral: 2, presion: -3 },
      },
    ],
  }),

  p('dialogo_despedida_jugador', {
    tags: ['individual', 'vestuario'],
    intensidad: INTENSIDAD.ALTA,
    filtro: (c) => !!c.figura && c.temporada >= 3 && c.posicion <= 5,
    titulo: 'Una charla difícil',
    texto: '{figura} te pide hablar en privado. "Mister, vino una oferta de afuera. Es la chance de mi vida. Quiero que sepas que acá fui feliz, pero necesito dar este paso."',
    opciones: [
      {
        id: 'lo_deja_ir',
        label: 'Andá tranquilo, te lo ganaste',
        resultado: [
          { prob: 100, efectos: { moral: -8, money: 15, ratingDelta: -3 }, texto: 'El plantel lo despidió con un aplauso. Queda un hueco grande.' },
        ],
      },
      {
        id: 'intenta_retener',
        label: 'Te necesito acá, no te vayas',
        resultado: [
          { prob: 30, efectos: { moral: 10, presion: -5 }, texto: 'Se quedó. El vestuario está eufórico.' },
          { prob: 70, efectos: { moral: -12, presion: 10 }, texto: 'Se fue igual. Ahora está resentido y el plantel también.' },
        ],
      },
    ],
  }),

  p('dialogo_reclamo_sueldo', {
    tags: ['individual', 'institucional'],
    intensidad: INTENSIDAD.MEDIA,
    filtro: (c) => !!c.figura && c.money >= 20 && c.temporada >= 2,
    titulo: 'Negociación salarial',
    texto: '{figura} viene con su representante. "Mister, con todo respeto, estoy rindiendo por encima de lo que cobro. Queremos renegociar el contrato o vamos a escuchar ofertas."',
    opciones: [
      {
        id: 'aumenta_sueldo',
        label: 'Le subo el sueldo',
        efectos: { money: -10, moral: 8, fatiga: -3 },
      },
      {
        id: 'rechaza_aumento',
        label: 'No hay presupuesto',
        resultado: [
          { prob: 50, efectos: { moral: -6, presion: 5 }, texto: 'Se enojó pero se quedó callado.' },
          { prob: 50, efectos: { moral: -10, presion: 10, ratingDelta: -2 }, texto: 'Empezó a fallar en cancha. Está con la cabeza afuera.' },
        ],
      },
    ],
  }),
];

/** Catálogo de eventos graves (forzados, sin elección). Solo aparecen en modo difícil. */
export const CATALOGO_GRAVES = CATALOGO.filter((e) => e.grave);

/** Devuelve el paquete completo por id. Los ids siempre salen de este catálogo (o de la IA validada contra él). */
export function paquete(id) {
  const p = CATALOGO.find((x) => x.id === id);
  if (!p) throw new Error(`Paquete de evento "${id}" no existe en el catálogo`);
  return p;
}


