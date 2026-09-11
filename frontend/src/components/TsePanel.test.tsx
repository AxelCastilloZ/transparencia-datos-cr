import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { TsePanel } from './TsePanel';
vi.mock('../api', () => ({
  api: {
    tse: {
      resumen: vi.fn(),
      porCanton: vi.fn(),
      distritos: vi.fn(),
      historico: vi.fn(),
    },
  },
}));
const resumen = {
  fuente: 'TSE',
  fechaCorte: '2026-08-31',
  cantonCodigo: null,
  total: 100,
  totalNacional: 1000,
  porcentajeNacional: 10,
  alcance: 'Excluye extranjero',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.tse.resumen).mockResolvedValue(resumen);
  vi.mocked(api.tse.porCanton).mockResolvedValue(resumen);
  vi.mocked(api.tse.distritos).mockResolvedValue([
    {
      fechaCorte: '2026-08-31',
      cantonCodigo: '612',
      distritoCodigo: '612001',
      distrito: 'DISTRITO SINTETICO',
      total: 100,
    },
  ]);
  vi.mocked(api.tse.historico).mockResolvedValue([]);
});
describe('TsePanel', () => {
  it('muestra loading, fuente, corte y alcance correcto', async () => {
    render(<TsePanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText(/Fecha de corte: 2026-08-31/)).toBeInTheDocument();
    expect(screen.getByText(/no equivale a participación/)).toBeInTheDocument();
  });
  it('cambia las consultas con el selector y muestra distritos', async () => {
    const view = render(<TsePanel canton="612" />);
    expect(await screen.findByText('DISTRITO SINTETICO')).toBeInTheDocument();
    view.rerender(<TsePanel canton="613" />);
    await waitFor(() =>
      expect(api.tse.porCanton).toHaveBeenLastCalledWith('613'),
    );
    expect(api.tse.distritos).toHaveBeenLastCalledWith('613');
    expect(api.tse.historico).toHaveBeenLastCalledWith('613');
  });
  it('muestra estado vacío', async () => {
    vi.mocked(api.tse.resumen).mockResolvedValue({
      ...resumen,
      fechaCorte: null,
      total: 0,
    });
    render(<TsePanel />);
    expect(await screen.findByText(/No hay snapshots/)).toBeInTheDocument();
  });
  it('maneja error y evita mostrar datos del cantón anterior', async () => {
    vi.mocked(api.tse.porCanton).mockRejectedValue(new Error('fallo'));
    render(<TsePanel canton="612" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar',
    );
  });
});
