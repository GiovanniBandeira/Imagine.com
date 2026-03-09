import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Image as ImageIcon, ArrowUp, X, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import galeriaData from './data/galeria.json';

const WHATSAPP_NUMBER = "5583993913523";

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null); // Para o Modal de Álbum
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Controle do Carrossel

  // Gerar Categorias Dinamicamente com base no Drive!
  const uniqueCategories = Array.from(new Set(galeriaData.map(item => item.category)));
  const CATEGORIES = ['Todos', ...uniqueCategories].sort();

  // Função de Filtragem Conjunta
  const filteredModels = galeriaData.filter(model => {
    const matchTerm = `${model.title} ${model.subcategory} ${model.category}`.toLowerCase();
    const matchesSearch = matchTerm.includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || model.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Mostra botão de Topo ao rolar a página
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Funis de Venda WhatsApp
  const handleWhatsappDefault = () => {
    const msg = `Olá, vim pelo site e queria ver outros modelos além do que encontrei no site!${searchTerm ? ` Estava procurando por: ${searchTerm}` : ''}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsappNotFound = () => {
    const msg = `Olá, vim pelo site e me interessei, mas não encontrei o modelo que eu queria!${searchTerm ? ` Busquei por: ${searchTerm}` : ''}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsappBuy = (model) => {
    const hierarquia = model.breadcrumb || `${model.category} > ${model.title}`;
    const msg = `Olá, vim pelo site e gostei muito de um modelo!\n\n*É esse que eu quero:*\n📂 ${hierarquia}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header Fixo Minimalista */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              to="/"
              className="p-3 bg-white/5 rounded-full hover:bg-[#00ff41] hover:text-black transition-all group"
              title="Voltar ao início"
            >
              <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Cátalogo de Modelos</h1>
          </div>

          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="PESQUISAR MODELOS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border-2 border-white/10 rounded-full px-6 py-4 pl-14 text-white placeholder-gray-500 focus:outline-none focus:border-[#00ff41] transition-colors font-bold tracking-widest uppercase text-sm"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          </div>
        </div>
      </header>

      {/* Aviso Oficial (Solicitado pelo Lojista) */}
      <div className="bg-[#111] border-b border-[#00ff41]/20 p-3 text-center">
        <p className="text-[#00ff41] text-xs md:text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2">
          <InfoIcon /> Atenção: Este é um mostruário dos nossos modelos mais procurados. Não achou o que procura? Entre em contato!
        </p>
      </div>

      {/* Régua de Categorias Horizontal */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs transition-all border-2 
                  ${selectedCategory === cat
                  ? 'bg-[#00ff41] border-[#00ff41] text-black shadow-[0_0_15px_rgba(0,255,65,0.4)]'
                  : 'bg-transparent border-white/20 text-gray-400 hover:border-white/50 hover:text-white'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        {filteredModels.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center gap-4 text-center border border-dashed border-white/10 rounded-2xl p-8 bg-[#111]">
            <Search size={48} className="text-gray-600 mb-2" />
            <h3 className="text-2xl font-black uppercase tracking-tighter">Nada encontrado</h3>
            <p className="text-gray-400 max-w-sm text-sm mb-6">Nenhum modelo estático bateu com "{searchTerm}" na categoria {selectedCategory}.</p>

            {/* CTA Vazio -> Buscar Nuvem / Especial */}
            <button
              onClick={handleWhatsappNotFound}
              className="bg-[#00ff41] text-black px-8 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2 animate-pulse hover:animate-none"
            >
              Não encontrou? Fale no WhatsApp! <MessageCircle size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => { setSelectedModel(model); setCurrentImageIndex(0); }}
                  className="group cursor-pointer bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden hover:border-[#00ff41] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] flex flex-col"
                >
                  <div className="aspect-square relative overflow-hidden bg-[#222]">
                    <img
                      src={model.url}
                      alt={model.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />

                    {/* Badge de Álbum caso tenha várias imagens */}
                    {model.images && model.images.length > 1 && (
                      <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-white/20 text-white shadow-sm flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-[#00ff41]" /> {model.images.length}
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="font-bold text-lg tracking-tight truncate text-white">{model.title}</h4>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsappBuy(model); }}
                      className="mt-4 w-full bg-transparent border border-[#00ff41] text-[#00ff41] py-2.5 rounded hover:bg-[#00ff41] hover:text-black font-bold uppercase text-xs tracking-widest transition-colors flex justify-center items-center gap-2"
                    >
                      É Esse que eu quero!
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Fim da Lista -> Rodapé de Contato Secundário */}
            <div className="flex flex-col items-center justify-center text-center p-12 bg-[#111] rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-xl font-black uppercase tracking-widest text-[#00ff41]">Chegou ao fim!</h3>
              <p className="text-gray-400 text-sm max-w-lg mb-2">Se você não gostou de nenhum modelo da vitrine atual, saiba que temos milhares de outras opções no nosso acervo fechado.</p>
              <button
                onClick={handleWhatsappDefault}
                className="bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-widest hover:bg-[#00ff41] hover:text-black transition-all flex items-center gap-2"
              >
                Ver Outros Modelos no WhatsApp
              </button>
            </div>
          </>
        )}
      </main>

      {/* MODAL DE ÁLBUM (Quando clica no card inteiro) */}
      {selectedModel && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <button
            onClick={() => setSelectedModel(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors z-50"
          >
            <X size={24} />
          </button>

          <div className="w-full max-w-5xl bg-[#111] rounded-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex justify-between items-center z-10 bg-[#111]">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-[#00ff41]">{selectedModel.title}</h3>
              </div>
              <button
                onClick={() => handleWhatsappBuy(selectedModel)}
                className="hidden md:flex bg-[#00ff41] text-black px-6 py-3 rounded font-black uppercase tracking-widest hover:bg-white transition-colors items-center gap-2 text-sm drop-shadow-[0_0_10px_rgba(0,255,65,0.3)]"
              >
                É esse que eu quero! <MessageCircle size={16} />
              </button>
            </div>

            {/* Carrossel de Imagem Única */}
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[40vh] md:min-h-[60vh] overflow-hidden group">
              {/* Imagem Atual */}
              <img
                src={selectedModel.images && selectedModel.images.length > 0 ? selectedModel.images[currentImageIndex] : selectedModel.url}
                alt={`${selectedModel.title} Foto ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none"
                loading="lazy"
              />

              {/* Controles do Carrossel (Visíveis apenas se houver mais de 1 imagem) */}
              {selectedModel.images && selectedModel.images.length > 1 && (
                <>
                  {/* Botão Anterior */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => prev === 0 ? selectedModel.images.length - 1 : prev - 1);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-[#00ff41] hover:text-black transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  {/* Botão Próximo */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => prev === selectedModel.images.length - 1 ? 0 : prev + 1);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-[#00ff41] hover:text-black transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-white/10"
                  >
                    <ChevronRight size={24} />
                  </button>

                  {/* Paginador (Bolinhas) */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                    {selectedModel.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-[#00ff41] scale-125' : 'bg-white/30 hover:bg-white/70'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Botão Mobile no Modal */}
            <div className="p-4 border-t border-white/10 md:hidden">
              <button
                onClick={() => handleWhatsappBuy(selectedModel)}
                className="w-full bg-[#00ff41] text-black px-6 py-4 rounded font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                É esse que eu quero! <MessageCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante Voltar ao Topo */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-4 bg-[#00ff41] text-black rounded-full shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:scale-110 hover:bg-white transition-all z-40 group animate-bounce"
        >
          <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
        </button>
      )}

    </div>
  );
};

// Ícone simples de info pq do lucide ficou estranho em alguns renders
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 16v-4"></path>
    <path d="M12 8h.01"></path>
  </svg>
);

export default SearchPage;
