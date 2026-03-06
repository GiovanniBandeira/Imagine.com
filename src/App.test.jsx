import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock do window.matchMedia para não quebrar carrosséis ou hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Global Fetch
global.fetch = vi.fn((url) => {
  return Promise.resolve({
    json: () => {
      // Retorna array vazio pro showcase para não dar erro
      if(url.includes('/api/showcase')) {
        return Promise.resolve({ images: [] });
      }
      return Promise.resolve({});
    }
  });
});

describe('App Component', () => {
  it('Deve renderizar o Menu (Navbar) com o logotipo e textos', () => {
    render(<App />);
    const logoText = screen.getAllByText(/IMAGINE/i);
    expect(logoText.length).toBeGreaterThan(0);
    
    // Verifica links do menu (podem aparecer no header e no footer)
    expect(screen.getAllByText('Início').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Modelos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sobre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Feedback').length).toBeGreaterThan(0);
  });

  it('Deve renderizar o Hero Banner', () => {
    render(<App />);
    const heroTitle = screen.getByText(/Damos vida à sua/i);
    expect(heroTitle).toBeInTheDocument();
  });

  it('Deve renderizar a seção Sobre', () => {
    render(<App />);
    const sobreTitle = screen.getByText(/Sobre a Imagine/i);
    expect(sobreTitle).toBeInTheDocument();
  });
  
  it('Deve renderizar a seção de Feedback e permitir clique nos botões', async () => {
    render(<App />);
    const feedbackTitle = screen.getByText(/Compartilhe a sua/i);
    expect(feedbackTitle).toBeInTheDocument();
    // Verifica botão de submit
    const submitBtn = screen.getByText(/Enviar Feedback/i);
    expect(submitBtn).toBeInTheDocument();
  });

});
