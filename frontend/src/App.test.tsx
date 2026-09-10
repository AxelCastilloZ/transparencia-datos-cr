import { render, screen } from '@testing-library/react';
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
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
}) as unknown as typeof fetch;

describe('App', () => {
  it('renderiza el título y el selector de cantón', async () => {
    render(<App />);
    expect(screen.getByText(/Transparencia CR/i)).toBeInTheDocument();
    expect(screen.getByText(/Seleccioná un cantón/i)).toBeInTheDocument();
  });

  it('muestra el conteo total de registros', async () => {
    render(<App />);
    // Esperar a que se resuelva el fetch de status.
    // El separador de miles depende del locale/ICU del entorno (coma, espacio
    // o espacio fino), así que se acepta cualquier separador entre los grupos.
    const stat = await screen.findByText(/103\D?875/);
    expect(stat).toBeInTheDocument();
  });
});
