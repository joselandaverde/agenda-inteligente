// api/interpretar.js
// Recibe un texto (dictado o escrito) y le pide a Claude, vía Vercel AI Gateway,
// que lo interprete y devuelva los campos del compromiso ya organizados.
// La llave (AI_GATEWAY_API_KEY) vive protegida en Vercel, nunca en el navegador.

export default async function handler(req, res) {
  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { texto } = req.body;

  if (!texto || !texto.trim()) {
    return res.status(400).json({ error: 'Falta el texto a interpretar' });
  }

  // Fecha de hoy, para que Claude sepa a qué se refieren cosas como "mañana" o "el viernes"
  const hoy = new Date().toISOString().split('T')[0];

  const instrucciones = `Eres un asistente que interpreta texto en español dictado por un usuario
y lo convierte en los campos de un compromiso de agenda. Responde SOLO con un
objeto JSON válido, sin texto adicional, sin explicaciones, sin comillas de markdown.

La fecha de hoy es: ${hoy}

Interpreta el texto y devuelve exactamente estos campos:
{
  "titulo": "string corto y claro, sin la fecha/hora/tipo mencionados en el texto",
  "tipo": "Reunión" | "Tarea" | "Recordatorio",
  "fecha": "YYYY-MM-DD o null si no se menciona ninguna fecha",
  "hora12": "número del 1 al 12, o null si no se menciona hora",
  "minutos": "00, 15, 30 o 45 (redondea al más cercano), o null si no se menciona hora",
  "ampm": "AM o PM, o null si no se menciona hora",
  "importancia": "Muy alta" | "Alta" | "Media" | "Baja" | "Muy baja"
}

Reglas para decidir el tipo:
- "Reunión": si menciona reunirse, ver, llamar, hablar CON alguien más.
- "Recordatorio": si es solo un aviso puntual, sin acción a realizar (ej. "recuérdame llamar al banco").
- "Tarea": cualquier otro pendiente por hacer.

Si no se menciona importancia, usa "Media" por defecto.
Si no se menciona fecha/hora, deja esos campos en null (no inventes).

Texto del usuario: "${texto}"`;

  try {
    const respuesta = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: instrucciones }],
        stream: false,
      }),
    });

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text();
      console.error('Error del Gateway:', errorTexto);
      return res.status(500).json({ error: 'Error al conectar con la IA' });
    }

    const datos = await respuesta.json();
    const textoRespuesta = datos.choices?.[0]?.message?.content || '';

    // Limpiar por si la IA envuelve el JSON en ```json ... ```
    const limpio = textoRespuesta.replace(/```json|```/g, '').trim();

    let interpretado;
    try {
      interpretado = JSON.parse(limpio);
    } catch (e) {
      console.error('No se pudo interpretar la respuesta:', textoRespuesta);
      return res.status(500).json({ error: 'La IA no devolvió un formato válido' });
    }

    return res.status(200).json(interpretado);
  } catch (error) {
    console.error('Error general:', error);
    return res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}
