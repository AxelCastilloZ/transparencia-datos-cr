import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Mock fetch para que no falle por falta de backend
globalThis.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/cantones')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          { codigo: '101', nombre: 'San José', provincia: 'San José' },
          { codigo: '201', nombre: 'Alajuela', provincia: 'Alajuela' },
        ]),
    });
  }
  if (url.includes('/api/judicial/status')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ fuente: 'OIJ', registros: 103875 }),
    });
  }
  if (url === '/api/tse/canton/201') {
    return Promise.resolve({ ok: true, json: async () => ({
      fechaCorte: '2026-08-31', total: 1234, porcentajeNacional: 12.34,
      alcance: 'Ejemplo sintético',
    }) });
  }
  if (url === '/api/tse/canton/201/distritos') {
    return Promise.resolve({ ok: true, json: async () => [{ distritoCodigo: '201001', distrito: 'DISTRITO DE PRUEBA', total: 1234 }] });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
}) as unknown as typeof fetch;

describe('App', () => {
  it('renderiza el título y el selector de cantón', async () => {
    render(<App />);
    expect(screen.getByText(/Transparencia CR/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cantón' })).toBeInTheDocument();
  });

  it('muestra el conteo total de registros', async () => {
    render(<App />);
    // Esperar a que se resuelva el fetch de status.
    // El separador de miles depende del locale/ICU del entorno (coma, espacio
    // o espacio fino), así que se acepta cualquier separador entre los grupos.
    const stat = await screen.findByText(/103\D?875/);
    expect(stat).toBeInTheDocument();
  });
  it('permite seleccionar desde TSE y sincroniza el selector global y los distritos', async () => {
    const user = userEvent.setup();
    render(<App />);
    const selector = screen.getByRole('combobox', { name: 'Cantón del padrón electoral' });
    await waitFor(() => expect(selector).toBeEnabled());
    await user.selectOptions(selector, '201');
    expect(screen.getByRole('combobox', { name: 'Cantón' })).toHaveValue('201');
    expect(await screen.findByText('DISTRITO DE PRUEBA')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Padrón electoral — TSE · Alajuela' })).toBeInTheDocument();
    await user.selectOptions(selector, '');
    expect(screen.getByRole('combobox', { name: 'Cantón' })).toHaveValue('');
    await waitFor(() => expect(screen.queryByText('DISTRITO DE PRUEBA')).not.toBeInTheDocument());
  });
});
