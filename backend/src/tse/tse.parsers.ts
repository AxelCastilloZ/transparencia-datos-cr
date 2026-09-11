/** Los errores nunca incluyen líneas, campos personales ni contenido externo. */
export function validarCodelec(code: string): string {
  if (!/^[1-8]\d{5}$/.test(code) || code.slice(3) === '000')
    throw new Error('CODELEC inválido');
  return code.slice(0, 3);
}

export function parsePadron(line: string): string {
  const fields = line.split(',');
  const lengths = [9, 6, 1, 8, 5, 30, 26, 26];
  if (fields.length !== 8 || fields.some((f, i) => f.length > lengths[i]))
    throw new Error('Estructura de padrón inválida');
  if (
    !/^\d{9}$/.test(fields[0]) ||
    fields[1].length !== 6 ||
    !/^\d{8}$/.test(fields[3]) ||
    !/^\d{5}$/.test(fields[4]) ||
    fields[2].length !== 1 ||
    !fields[5].trim()
  )
    throw new Error('Longitudes o formato de padrón inválidos');
  validarCodelec(fields[1]);
  return fields[1]; // Único campo que sale del parser.
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

/** Verifica integridad ZIP, incluso cuando la truncación deja líneas válidas. */
export async function* verificarEntrada(
  input: AsyncIterable<Uint8Array>,
  size: number,
  expectedCrc: number,
) {
  let crc = 0xffffffff;
  let bytes = 0;
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > size || bytes > 1_000_000_000)
      throw new Error('Tamaño ZIP inválido');
    for (const byte of chunk) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
    yield chunk;
  }
  if (bytes !== size || (crc ^ 0xffffffff) >>> 0 !== expectedCrc >>> 0)
    throw new Error('Integridad ZIP inválida');
}

export function parseDistrito(line: string) {
  // El catálogo oficial incluye comas sin comillas dentro del nombre final.
  const parts = line.split(',');
  const fields = [...parts.slice(0, 3), parts.slice(3).join(',')].map((f) =>
    f.trim(),
  );
  if (
    fields.length !== 4 ||
    fields[0].length !== 6 ||
    fields.slice(1).some((f) => !f || f.length > 100)
  )
    throw new Error('Catálogo electoral inválido');
  const cantonCodigo = validarCodelec(fields[0]);
  return { distritoCodigo: fields[0], cantonCodigo, distrito: fields[3] };
}

/** Windows-1252, límite por línea y por archivo; no acumula registros individuales. */
export async function* lineas(
  input: AsyncIterable<Uint8Array>,
  maxBytes = 1_000_000_000,
) {
  const decoder = new TextDecoder('windows-1252');
  let pending = '';
  let bytes = 0;
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('Archivo excede límite');
    pending += decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end).replace(/\r$/, '');
      pending = pending.slice(end + 1);
      if (line.length > 1024) throw new Error('Línea excede límite');
      if (line.trim()) yield line;
    }
    if (pending.length > 1024) throw new Error('Línea excede límite');
  }
  pending += decoder.decode();
  if (pending.trim()) yield pending.replace(/\r$/, '');
}

export function fechaPublicacion(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const match = text.match(
    /actualizado\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})/i,
  );
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  if (!match) throw new Error('Fecha de corte no disponible');
  const month = meses.indexOf(match[2].toLowerCase()) + 1;
  const date = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  if (
    !month ||
    Number(match[1]) < 1 ||
    Number(match[1]) > 31 ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error('Fecha de corte inválida');
  return date;
}

export async function agregarPadron(
  input: AsyncIterable<Uint8Array>,
  distritos: Map<string, ReturnType<typeof parseDistrito>>,
  cantones: Set<string>,
) {
  const conteos = new Map<string, number>();
  let exterior = 0;
  for await (const line of lineas(input)) {
    const code = parsePadron(line);
    const canton = code.slice(0, 3);
    if (!distritos.has(code)) throw new Error('Distrito desconocido');
    if (code.startsWith('8')) {
      exterior++;
      continue;
    }
    if (!cantones.has(canton)) throw new Error('Cantón desconocido');
    conteos.set(code, (conteos.get(code) ?? 0) + 1);
  }
  if (!conteos.size) throw new Error('Padrón nacional vacío');
  return { conteos, exterior };
}
