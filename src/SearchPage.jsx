import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, MessageCircle, X, ChevronLeft, ChevronRight, Loader2, EyeOff, Flag } from 'lucide-react';

const SearchPage = ({ onBack, scriptUrl }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState(null);

  // Album Modal state
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // NSFW State
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pendingNsfwAlbum, setPendingNsfwAlbum] = useState(null);
  const [reportingId, setReportingId] = useState(null);

  // Fake data for testing before the real script URL is ready
  const DUMMY_DATA = [
    {
      id: '1',
      name: 'Busto Homem de Ferro',
      images: [
        { url: 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=500&h=500&fit=crop', name: 'iron1.jpg' },
        { url: 'https://images.unsplash.com/photo-1549313861-3358f54407b3?w=500&h=500&fit=crop', name: 'iron2.jpg' }
      ]
    },
    {
      id: '2',
      name: 'Miniatura Darth Vader',
      images: [
        { url: 'https://images.unsplash.com/photo-1478479405421-ce83c92fb3ba?w=500&h=500&fit=crop', name: 'vader.jpg' }
      ]
    },
    {
      id: '3',
      name: 'Action Figure Goku',
      images: [
        { url: 'https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?w=500&h=500&fit=crop', name: 'goku1.jpg' },
        { url: 'https://images.unsplash.com/photo-1606663889134-b1dedb5ed8b7?w=500&h=500&fit=crop', name: 'goku2.jpg' },
        { url: 'https://images.unsplash.com/photo-1534800891164-a1d96b5114e7?w=500&h=500&fit=crop', name: 'goku3.jpg' }
      ]
    }
  ];

  const fetchModels = async (token = null, searchArg = '') => {
    // Aponta para a API Backend Local que acabamos de criar no Render
    const BACKEND_URL = 'https://imagine-com.onrender.com/api/models';

    try {
      const isLoadMore = token !== null; // Determine if it's a "load more" call
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Add the token and search query to the URL
      const url = new URL(BACKEND_URL);
      if (token) url.searchParams.append('pageToken', token);
      if (searchArg) url.searchParams.append('search', searchArg);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Servidor indisponível');
      }

      const isBuilding = response.headers.get('x-cache-status') === 'building';
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Obter os modelos do JSON no novo formato da API Node.js
        const fetchedModels = data.models || [];

        if (token) {
          // If paginating, append
          setModels(prev => [...prev, ...fetchedModels]);
        } else {
          setModels(fetchedModels);
        }
        // Save the next page token
        setNextPageToken(data.nextPageToken || null);

        // Se o servidor ainda estiver construindo o cache no fundo, recarrega daqui a 5 segundos
        // Isso faz com que a galeria "brote" na tela progressivamente, sem travar o usuário
        if (isBuilding && !token) {
          setTimeout(() => {
            fetchModels(null, searchArg);
          }, 5000);
        }
      }
    } catch (err) {
      setError('Erro ao conectar com a API Backend. Certifique-se de que o Terminal do servidor está rodando!');
      console.error("Fetch error: ", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Auto-Fetch Debounced: Aciona API do servidor .5s após o usuário parar de digitar
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchModels(null, searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, scriptUrl]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedAlbum) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedAlbum]);

  const handleWhatsAppRedirect = () => {
    const message = encodeURIComponent("Olá, vim pelo site, queria fazer o pedido de um modelo que não encontrei no site.");
    window.open(`https://wa.me/5583993913523?text=${message}`, '_blank');
  };

  const handleWhatsAppRedirectPedido = () => {
    if (!selectedAlbum) return;
    const message = encodeURIComponent(`Olá, vim pelo site, queria fazer o pedido do modelo: *${selectedAlbum.name}*`);
    window.open(`https://wa.me/5583993913523?text=${message}`, '_blank');
  };

  const handleReport = async (e, model) => {
    e.stopPropagation();
    if (reportingId) return;
    
    // Confirmação dupla para não reportar sem querer
    if (!window.confirm(`Deseja denunciar "${model.name}" como conteúdo Explícito/Sensível? A IA analisará na hora.`)) return;
    
    setReportingId(model.id);
    try {
      const BACKEND_URL = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000/api/report' 
          : 'https://imagine-com.onrender.com/api/report';

      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           folderId: model.id, 
           imageUrl: model.images[0]?.url.startsWith('http') ? model.images[0].url : `https://imagine-com.onrender.com${model.images[0]?.url}` 
        })
      });
      const data = await res.json();
      
      if (data.banned) {
         alert('🚨 Denúncia Aceita: O conteúdo foi removido/ocultado pela IA.');
         // Atualiza Tela Imediatamente
         setModels(prev => prev.map(m => m.id === model.id ? { ...m, isNsfw: true } : m));
      } else {
         alert('ℹ️ Denúncia Verificada: O Sistema de IA não detectou violações drásticas. A denúncia foi arquivada.');
      }
    } catch(err) {
      alert('Erro de comunicação. O servidor de IA está ocupado no momento.');
    } finally {
      setReportingId(null);
    }
  };

  const openAlbum = (model) => {
    if (model.isNsfw && !ageConfirmed) {
      setPendingNsfwAlbum(model);
    } else {
      setSelectedAlbum(model);
      setCurrentImageIndex(0);
    }
  };

  const closeAlbum = () => {
    setSelectedAlbum(null);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    if (selectedAlbum && currentImageIndex < selectedAlbum.images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header & Search Bar */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-[#00ff41] transition-colors self-start md:self-auto font-bold uppercase text-sm tracking-widest"
          >
            <ChevronLeft size={20} /> Voltar
          </button>

          <div className="w-full md:max-w-xl relative">
            <input
              type="text"
              placeholder="Pesquisar por modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-4 pl-14 pr-6 text-white focus:outline-none focus:border-[#00ff41] transition-colors"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="animate-spin text-[#00ff41]" size={40} />
            <p className="uppercase tracking-widest text-sm font-bold">Carregando modelos...</p>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4 text-red-400">
            <p className="text-center max-w-lg">{error}</p>
          </div>
        ) : (
          <>
            {models.length === 0 ? (
              /* No Results State */
              <div className="h-[50vh] flex flex-col items-center justify-center gap-6 text-center border border-dashed border-white/10 rounded-2xl p-8 bg-[#111]">
                <Search size={48} className="text-gray-600 mb-2" />
                <h3 className="text-3xl font-black uppercase tracking-tighter">Modelo não encontrado</h3>
                <p className="text-gray-400 max-w-md">Não encontrou o que procurava? Fale conosco direto no WhatsApp e nós produzimos para você!</p>
                <button
                  onClick={handleWhatsAppRedirect}
                  className="mt-4 bg-[#00ff41] text-black px-8 py-4 font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center gap-2 rounded-full"
                >
                  <MessageCircle size={20} /> Solicitar via WhatsApp
                </button>
              </div>
            ) : (
              /* Gallery Grid */
              <div className="space-y-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => openAlbum(model)}
                      className="group cursor-pointer bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden hover:border-[#00ff41]/50 transition-all"
                    >
                      <div className="aspect-square relative overflow-hidden bg-[#222]">
                        <img
                          // O Backend Server serve o proxy da imagem
                          src={model.images[0]?.url.startsWith('http') ? model.images[0].url : `https://imagine-com.onrender.com${model.images[0]?.url}`}
                          alt={model.name}
                          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${model.isNsfw && !ageConfirmed ? 'blur-[40px] scale-150 grayscale-[50%]' : ''}`}
                          loading="lazy"
                        />
                        
                        {/* Botão de Denúncia Flutuante Inteligente */}
                        {!model.isNsfw && (
                          <button 
                             onClick={(e) => handleReport(e, model)}
                             disabled={reportingId === model.id}
                             title="Denunciar como Adulto (+18)"
                             className="absolute top-3 left-3 bg-black/40 hover:bg-red-600/90 backdrop-blur-md p-2 rounded-full text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10 disabled:opacity-100"
                          >
                            {reportingId === model.id ? <Loader2 size={16} className="animate-spin text-white" /> : <Flag size={16} />}
                          </button>
                        )}
                        {/* Seleção +18 Minimalista */}
                        {model.isNsfw && !ageConfirmed && (
                           <div className="absolute inset-0 flex items-end justify-start p-3 bg-black/20 transition-all">
                              <div className="bg-red-500/20 backdrop-blur-md text-red-500 font-black px-3 py-1.5 rounded-md border border-red-500/30 text-sm tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                +18
                              </div>
                           </div>
                        )}
                        {model.images.length > 1 && (
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold border border-white/10 text-white">
                            <ImageIcon size={14} className="text-[#00ff41]" />
                            {model.images.length}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-lg truncate"></h4>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                          {model.images.length > 1 ? 'Ver Álbum' : 'Ver Imagem'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {nextPageToken && (
                  <div className="flex justify-center mt-12 mb-8">
                    <button
                      onClick={() => fetchModels(nextPageToken, searchTerm)}
                      disabled={loadingMore}
                      className="bg-transparent border-2 border-white/20 text-white px-8 py-3 font-bold uppercase tracking-widest hover:border-[#00ff41] hover:text-[#00ff41] transition-all rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <><Loader2 className="animate-spin" size={18} /> Carregando...</>
                      ) : (
                        "Mostrar Mais Modelos"
                      )}
                    </button>
                  </div>
                )}

                {/* Not Found CTA at the bottom */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-[#111] border border-[#00ff41]/20 rounded-2xl p-8 gap-6">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-xl font-black uppercase tracking-tighter">Não encontrou o modelo que deseja?</h3>
                    <p className="text-gray-400 text-sm">Entre em contato que lhe ajudamos.</p>
                  </div>
                  <button
                    onClick={handleWhatsAppRedirect}
                    className="bg-transparent border-2 border-[#00ff41] text-[#00ff41] px-6 py-3 font-black uppercase tracking-tighter hover:bg-[#00ff41] hover:text-black transition-all flex items-center gap-2 rounded-full whitespace-nowrap"
                  >
                    <MessageCircle size={18} /> Pedir no WhatsApp
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Album Modal */}
      {selectedAlbum && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <button
            onClick={closeAlbum}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-[#00ff41] hover:text-black rounded-full transition-all text-white z-10"
          >
            <X size={24} />
          </button>

          <div className="max-w-5xl w-full h-[90vh] flex flex-col pt-10">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedAlbum.name}</h3>
              <p className="text-gray-400 text-sm tracking-widest uppercase mt-1">
                Imagem {currentImageIndex + 1} de {selectedAlbum.images.length}
              </p>
            </div>

            <div className="flex-1 relative flex items-center justify-center min-h-0">
              {/* Navigation Prev */}
              {selectedAlbum.images.length > 1 && (
                <button
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  className="absolute left-0 p-3 bg-black/50 border border-white/10 hover:border-[#00ff41] rounded-full disabled:opacity-30 disabled:hover:border-white/10 transition-all z-20 mix-blend-difference"
                >
                  <ChevronLeft size={32} />
                </button>
              )}

              <div className="w-full h-full max-h-[60vh] flex items-center justify-center relative">
                <img
                  // Usa o Backend para abrir a imagem pesada sem dar erro de CORS do Google
                  src={selectedAlbum.images[currentImageIndex].url.startsWith('http') ? selectedAlbum.images[currentImageIndex].url : `https://imagine-com.onrender.com${selectedAlbum.images[currentImageIndex].url}`}
                  alt={`${selectedAlbum.name} - ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                />
              </div>

              {/* Navigation Next */}
              {selectedAlbum.images.length > 1 && (
                <button
                  onClick={nextImage}
                  disabled={currentImageIndex === selectedAlbum.images.length - 1}
                  className="absolute right-0 p-3 bg-black/50 border border-white/10 hover:border-[#00ff41] rounded-full disabled:opacity-30 disabled:hover:border-white/10 transition-all z-20 mix-blend-difference"
                >
                  <ChevronRight size={32} />
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {selectedAlbum.images.length > 1 && (
              <div className="mt-8 flex gap-2 overflow-x-auto pb-4 justify-center">
                {selectedAlbum.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                    className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-[#00ff41]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={img.url.startsWith('http') ? img.url : `https://imagine-com.onrender.com${img.url}`} className="w-full h-full object-cover" alt="thumbnail" />
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleWhatsAppRedirectPedido}
              className="mt-6 mx-auto bg-[#00ff41] text-black px-6 py-3 font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center gap-2 rounded-full"
            >
              <MessageCircle size={18} /> Quero este Modelo
            </button>
          </div>
        </div>
      )}

      {/* Age Gate Modal */}
      {pendingNsfwAlbum && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111] border border-red-900/50 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <span className="text-2xl font-black">+18</span>
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Conteúdo Restrito</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              O modelo <strong>{pendingNsfwAlbum.name}</strong> pode conter nudez explícita ou imagens de caráter erotizado voltadas para o público adulto.
            </p>
            <div className="pt-4 space-y-3">
              <button
                onClick={() => {
                  setAgeConfirmed(true);
                  openAlbum(pendingNsfwAlbum);
                  setPendingNsfwAlbum(null);
                }}
                className="w-full bg-red-600 text-white px-6 py-4 font-black uppercase tracking-tighter hover:bg-red-500 transition-colors rounded-xl flex justify-center items-center gap-2"
              >
                Tenho mais de 18 anos
              </button>
              <button
                onClick={() => setPendingNsfwAlbum(null)}
                className="w-full bg-transparent border-2 border-white/10 text-gray-300 px-6 py-4 font-black uppercase tracking-tighter hover:bg-white/5 transition-colors rounded-xl"
              >
                Voltar com Segurança
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
