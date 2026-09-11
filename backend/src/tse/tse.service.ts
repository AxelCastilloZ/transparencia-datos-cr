import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Open } from 'unzipper';
import { Repository } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { TsePadronCantonal } from './tse-padron-cantonal.entity.js';
import { TsePadronDistrital } from './tse-padron-distrital.entity.js';
import {
  agregarPadron,
  fechaPublicacion,
  lineas,
  parseDistrito,
  verificarEntrada,
} from './tse.parsers.js';

export const TSE_PORTAL = 'https://www.tse.go.cr/descarga_padron.html';
export const TSE_ZIP = 'https://www.tse.go.cr/zip/padron/padron_completo.zip';

@Injectable()
export class TseService {
  private readonly logger = new Logger(TseService.name);
  private enCurso = false;
  private ultimoError: string | null = null;
  constructor(
    @InjectRepository(TsePadronCantonal)
    private readonly cantonal: Repository<TsePadronCantonal>,
    @InjectRepository(TsePadronDistrital)
    private readonly distrital: Repository<TsePadronDistrital>,
    @InjectRepository(Canton) private readonly cantones: Repository<Canton>,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 0 4 10 * *', { timeZone: 'America/Costa_Rica' })
  async refrescarDatos() {
    try {
      await this.sincronizar();
    } catch {
      this.logger.warn(
        'TSE: sincronización fallida; se conservan los snapshots.',
      );
    }
  }

  private async cortePublicado() {
    const response = await axios.get<string>(TSE_PORTAL, {
      timeout: 30_000,
      maxContentLength: 1_000_000,
      responseType: 'text',
    });
    return fechaPublicacion(response.data);
  }

  /** Solo el ZIP temporal contiene datos crudos. Nunca se extraen archivos a disco. */
  async descargarAgregados(cantones: Set<string>) {
    let carpeta: string | undefined;
    try {
      const corteFijado = this.config.get<string>('TSE_FECHA_CORTE');
      const hashFijado = this.config.get<string>('TSE_ZIP_SHA256');
      if (
        Boolean(corteFijado) !== Boolean(hashFijado) ||
        (corteFijado &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(corteFijado) ||
            new Date(corteFijado).toISOString().slice(0, 10) !==
              corteFijado)) ||
        (hashFijado && !/^[a-f0-9]{64}$/i.test(hashFijado))
      )
        throw new Error('Configuración de corte inválida');
      const fechaCorte = corteFijado ?? (await this.cortePublicado());
      carpeta = await mkdtemp(join(tmpdir(), 'transparencia-tse-'));
      const archivo = join(carpeta, 'padron.zip');
      const response = await axios.get<Readable>(TSE_ZIP, {
        responseType: 'stream',
        timeout: 180_000,
      });
      let bytes = 0;
      const hash = createHash('sha256');
      await pipeline(
        response.data,
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            hash.update(chunk);
            callback(
              bytes > 200_000_000 ? new Error('ZIP excede límite') : null,
              chunk,
            );
          },
        }),
        createWriteStream(archivo, { mode: 0o600 }),
      );
      if (hashFijado && hash.digest('hex') !== hashFijado.toLowerCase())
        throw new Error('ZIP no corresponde al corte configurado');
      const zip = await Open.file(archivo);
      const buscar = (nombre: RegExp) => {
        const entries = zip.files.filter((f) => nombre.test(f.path));
        if (entries.length !== 1) throw new Error('Contenido ZIP inválido');
        return entries[0];
      };
      const catalogo = buscar(/^distelec\.txt$/i);
      const padron = buscar(/^padron(?:_completo)?\.txt$/i);
      buscar(/^leame\.txt$/i);
      const distritos = new Map<string, ReturnType<typeof parseDistrito>>();
      for await (const line of lineas(
        verificarEntrada(
          catalogo.stream(),
          catalogo.uncompressedSize,
          catalogo.crc32,
        ),
        2_000_000,
      )) {
        const distrito = parseDistrito(line);
        if (distritos.has(distrito.distritoCodigo))
          throw new Error('Distrito duplicado');
        if (
          !distrito.distritoCodigo.startsWith('8') &&
          !cantones.has(distrito.cantonCodigo)
        )
          throw new Error('Cantón desconocido en catálogo');
        distritos.set(distrito.distritoCodigo, distrito);
      }
      const agregado = await agregarPadron(
        verificarEntrada(
          padron.stream(),
          padron.uncompressedSize,
          padron.crc32,
        ),
        distritos,
        cantones,
      );
      const presentes = new Set(
        [...agregado.conteos.keys()].map((c) => c.slice(0, 3)),
      );
      if (presentes.size !== 84 || [...cantones].some((c) => !presentes.has(c)))
        throw new Error('Cobertura nacional incompleta');
      // Detectar una publicación que cambió mientras se descargaba.
      if (!corteFijado && (await this.cortePublicado()) !== fechaCorte)
        throw new Error('Publicación cambió durante descarga');
      return { fechaCorte, distritos, ...agregado };
    } finally {
      if (carpeta) await rm(carpeta, { recursive: true, force: true });
    }
  }

  async sincronizar() {
    if (this.enCurso)
      throw new ConflictException('Ya hay una sincronización TSE en curso');
    this.enCurso = true;
    let etapa = 'lectura de cantones en la base de datos';
    try {
      const codigos = new Set(
        (await this.cantones.find()).map((c) => c.codigo),
      );
      etapa = 'descarga o validación del padrón';
      const datos = await this.descargarAgregados(codigos);
      const sincronizadoEn = new Date();
      const filasDistrito = [...datos.distritos.values()]
        .filter((d) => codigos.has(d.cantonCodigo))
        .map((d) => ({
          ...d,
          fechaCorte: datos.fechaCorte,
          total: datos.conteos.get(d.distritoCodigo) ?? 0,
        }));
      const filasCanton = [...codigos].map((cantonCodigo) => ({
        cantonCodigo,
        fechaCorte: datos.fechaCorte,
        fuente: TSE_ZIP,
        sincronizadoEn,
        total: filasDistrito
          .filter((d) => d.cantonCodigo === cantonCodigo)
          .reduce((sum, d) => sum + d.total, 0),
      }));
      etapa = 'escritura del snapshot en la base de datos';
      await this.cantonal.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(840613)');
        await manager.upsert(TsePadronCantonal, filasCanton, [
          'fechaCorte',
          'cantonCodigo',
        ]);
        // Reconciliar únicamente este corte; otros meses jamás se eliminan.
        await manager.delete(TsePadronDistrital, {
          fechaCorte: datos.fechaCorte,
        });
        for (let i = 0; i < filasDistrito.length; i += 500)
          await manager.upsert(
            TsePadronDistrital,
            filasDistrito.slice(i, i + 500),
            ['fechaCorte', 'distritoCodigo'],
          );
      });
      this.ultimoError = null;
      return {
        fechaCorte: datos.fechaCorte,
        cantones: filasCanton.length,
        distritos: filasDistrito.length,
        total: filasCanton.reduce((sum, c) => sum + c.total, 0),
        exteriorExcluido: datos.exterior,
      };
    } catch (error) {
      // Solo traducir errores conocidos a textos constantes. Nunca devolver
      // mensajes arbitrarios de axios, ZIP, SQL o registros de la fuente.
      const causas: Record<string, string> = {
        'Fecha de corte no disponible': 'No se pudo leer el corte oficial. Si el portal muestra CAPTCHA, configurá TSE_FECHA_CORTE y TSE_ZIP_SHA256 y reiniciá el backend.',
        'Configuración de corte inválida': 'Revisá TSE_FECHA_CORTE y TSE_ZIP_SHA256: deben estar configurados juntos y tener formato válido.',
        'ZIP no corresponde al corte configurado': 'El ZIP publicado cambió: verificá de nuevo su fecha de corte y SHA-256.',
        'Cobertura nacional incompleta': 'El padrón no cubre los 84 cantones esperados.',
      };
      const causa = error instanceof Error && Object.hasOwn(causas, error.message)
        ? causas[error.message]
        : `Falló la etapa de ${etapa}.`;
      this.ultimoError =
        `No se pudo sincronizar TSE; se conservan los snapshots existentes. ${causa}`;
      throw new ServiceUnavailableException(this.ultimoError);
    } finally {
      this.enCurso = false;
    }
  }

  private async validarCanton(codigo: string) {
    if (
      !/^[1-7]\d{2}$/.test(codigo) ||
      !(await this.cantones.findOneBy({ codigo }))
    )
      throw new NotFoundException('Cantón no encontrado');
  }

  private async ultimoCorte() {
    return (
      (await this.cantonal.find({ order: { fechaCorte: 'DESC' }, take: 1 }))[0]
        ?.fechaCorte ?? null
    );
  }

  async status() {
    const cortes = await this.cantonal
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.fechaCorte)::int', 'snapshots')
      .getRawOne<{ snapshots: number }>();
    return {
      fuente: TSE_PORTAL,
      fechaCorte: await this.ultimoCorte(),
      snapshots: cortes?.snapshots ?? 0,
      enCurso: this.enCurso,
      ultimoError: this.ultimoError,
      corteFijadoConfigurado: Boolean(this.config.get<string>('TSE_FECHA_CORTE') && this.config.get<string>('TSE_ZIP_SHA256')),
    };
  }

  async resumen(codigo?: string) {
    if (codigo) await this.validarCanton(codigo);
    const fechaCorte = await this.ultimoCorte();
    const filas = fechaCorte
      ? await this.cantonal.find({ where: { fechaCorte } })
      : [];
    const totalNacional = filas.reduce((sum, c) => sum + c.total, 0);
    const total = codigo
      ? (filas.find((c) => c.cantonCodigo === codigo)?.total ?? 0)
      : totalNacional;
    return {
      fuente: TSE_PORTAL,
      fechaCorte,
      cantonCodigo: codigo ?? null,
      total,
      totalNacional,
      porcentajeNacional: totalNacional ? (total / totalNacional) * 100 : 0,
      alcance:
        'Electores inscritos en los 84 cantones; excluye electores en el extranjero.',
    };
  }

  async historico(codigo: string) {
    await this.validarCanton(codigo);
    return this.cantonal.find({
      where: { cantonCodigo: codigo },
      order: { fechaCorte: 'ASC' },
    });
  }

  async distritos(codigo: string) {
    await this.validarCanton(codigo);
    const fechaCorte = await this.ultimoCorte();
    return fechaCorte
      ? this.distrital.find({
          where: { cantonCodigo: codigo, fechaCorte },
          order: { total: 'DESC', distritoCodigo: 'ASC' },
        })
      : [];
  }
}
