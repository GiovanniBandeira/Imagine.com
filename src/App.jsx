import React, { useState } from 'react';
import { Instagram, MessageCircle, Mail, Send, CheckCircle2, Info, ShoppingBag, Star } from 'lucide-react';

const App = () => {
  const [formData, setFormData] = useState({
    recomendaria: 'sim',
    qualidade: 'sim',
    comentario: ''
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // URL da Logo carregada
  const logoUrl = "Logo3.0.svg";
  const logoFooterUrl = "LogoVerde3.0.svg";

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('enviando');

    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzjC367WMlDcIu4iHGATEHVhWiSoafmnUAc5pZ7HVTnklEd9MicQJ2aR0LKtvEvlHNLKQ/exec"; 

    if (!GOOGLE_SHEET_URL) {
      setTimeout(() => {
        setStatus('sucesso');
        setLoading(false);
        setFormData({ recomendaria: 'sim', qualidade: 'sim', comentario: '' });
      }, 1500);
      return;
    }

    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setStatus('sucesso');
      setFormData({ recomendaria: 'sim', qualidade: 'sim', comentario: '' });
    } catch (error) {
      setStatus('erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#08F868] selection:text-black">
      
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-[#08F868] backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 items-center justify-center">
              <img 
                src={logoUrl} 
                alt="Logo Imagine" 
                className="w-full h-full"
              />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">IMAGINE</span>
          </div>
          <div className="hidden md:flex gap-8 font-bold uppercase text-xs tracking-widest">
            <a href="#home" className="hover:text-[#00ff41] transition-colors">Início</a>
            <a href="#sobre" className="hover:text-[#00ff41] transition-colors">Sobre</a>
            <a href="#contato" className="hover:text-[#00ff41] transition-colors">Contato</a>
            <a href="#feedback" className="hover:text-[#00ff41] transition-colors text-[#00ff41]">Feedback</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="home" className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#00ff41]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="inline-block bg-[#00ff41] text-black px-3 py-1 text-xs font-black uppercase tracking-widest mb-2">
              Action Figures & Colecionáveis 3D
            </div>
            <h1 className="text-6xl md:text-8xl font-black uppercase leading-none tracking-tighter">
              Damos vida à sua <span className="text-[#00ff41]">imaginação.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-lg leading-relaxed">
              Especialistas em impressão em resina de alta definição. De bonecos e descorações exclusivas, onde cada detalhe é pensado para você.
            </p>
            <div className="flex gap-4">
              <a href="https://wa.me/5583993913523" target="_blank" rel="noopener noreferrer" className="bg-[#00ff41] text-black px-8 py-4 font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center gap-2">
                Encomendar Agora <ShoppingBag size={18} />
              </a>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="w-full aspect-square bg-[#1a1a1a] border border-white/10 rounded-2xl flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-tr from-[#00ff41]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="text-center p-8">
                  <span className="block text-[#00ff41] font-black text-4xl mb-2 italic">IMAGINE 3D</span>
                  <span className="text-gray-500 uppercase text-sm tracking-widest italic">Arte • Tecnologia • Precisão</span>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sobre a Loja */}
      <section id="sobre" className="py-24 bg-[#111] border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Info className="text-[#00ff41]" /> Sobre a Imagine
              </h2>
              <div className="h-1 w-20 bg-[#00ff41]"></div>
              <p className="text-gray-400 text-lg leading-relaxed">
                A IMAGINE nasceu da paixão por transformar modelos digitais em obras de arte tangíveis. Utilizamos tecnologia de ponta em impressão 3D (Resina) para garantir que cada ruga, sombra e detalhe seja fiel ao criador original.
              </p>
              <ul className="space-y-4">
                {['Tamanho Customizável', 'Pintura Profissional', 'Material de Alta Resistência'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 font-bold uppercase text-sm">
                    <CheckCircle2 className="text-[#00ff41]" size={18} /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1a1a] p-6 border border-white/5 space-y-2">
                <h3 className="text-[#00ff41] font-black text-2xl tracking-tighter">100%</h3>
                <p className="text-xs uppercase text-gray-500 font-bold">Customizável</p>
              </div>
              <div className="bg-[#1a1a1a] p-6 border border-white/5 space-y-2">
                <h3 className="text-[#00ff41] font-black text-2xl tracking-tighter">HD</h3>
                <p className="text-xs uppercase text-gray-500 font-bold">Resina Premium</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section id="feedback" className="py-24 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-5xl font-black uppercase tracking-tighter">O que achou da <span className="text-[#00ff41]">experiência?</span></h2>
            <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Sua opinião nos ajuda a evoluir</p>
          </div>

          <form onSubmit={handleSubmitFeedback} className="bg-[#1a1a1a] border border-white/10 p-8 md:p-12 space-y-10">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <label className="block text-sm font-black uppercase tracking-widest">Recomendaria a loja para um amigo?</label>
                <div className="flex gap-4">
                  {['sim', 'não'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData({ ...formData, recomendaria: val })}
                      className={`flex-1 py-3 font-black uppercase tracking-tighter border transition-all ${
                        formData.recomendaria === val ? 'bg-[#00ff41] border-[#00ff41] text-black' : 'border-white/10 text-white hover:border-[#00ff41]/50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-black uppercase tracking-widest">A qualidade superou suas expectativas?</label>
                <div className="flex gap-4">
                  {['sim', 'não'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData({ ...formData, qualidade: val })}
                      className={`flex-1 py-3 font-black uppercase tracking-tighter border transition-all ${
                        formData.qualidade === val ? 'bg-[#00ff41] border-[#00ff41] text-black' : 'border-white/10 text-white hover:border-[#00ff41]/50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-black uppercase tracking-widest">Conte-nos mais sobre sua experiência:</label>
              <textarea
                value={formData.comentario}
                onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                required
                placeholder="Escreva aqui seu feedback..."
                className="w-full bg-black border border-white/10 p-4 min-h-[150px] focus:border-[#00ff41] outline-none transition-colors text-white resize-none"
              ></textarea>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                disabled={loading}
                className="w-full md:w-auto px-12 py-5 bg-[#00ff41] text-black font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Enviar Feedback'} <Send size={18} />
              </button>

              {status === 'sucesso' && (
                <div className="flex items-center gap-2 text-[#00ff41] font-bold animate-bounce">
                  <Star size={18} /> Feedback enviado com sucesso! Obrigado.
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Contato & Footer */}
      <footer id="contato" className="py-20 bg-black border-t border-white/5 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-20">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 overflow-hidden flex items-center justify-center">
                  <img 
                    src={logoFooterUrl} 
                    alt="Logo Imagine Footer" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-3xl font-black tracking-tighter uppercase italic">IMAGINE</span>
              </div>
              <p className="text-gray-500 text-sm">
                Transformando o digital em colecionável. Qualidade Ryodan Studio e Kaidan3D.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-black uppercase tracking-widest text-xs text-gray-400">Links Rápidos</h4>
              <nav className="flex flex-col gap-2 font-bold uppercase text-sm">
                <a href="#home" className="hover:text-[#00ff41]">Home</a>
                <a href="#sobre" className="hover:text-[#00ff41]">Sobre</a>
                <a href="#feedback" className="hover:text-[#00ff41]">Feedback</a>
              </nav>
            </div>

            <div className="space-y-4">
              <h4 className="font-black uppercase tracking-widest text-xs text-gray-400">Nossas Redes</h4>
              <div className="flex gap-4">
                <a href="https://instagram.com/imagine.hub_" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-[#1a1a1a] flex items-center justify-center hover:bg-[#00ff41] hover:text-black transition-all border border-white/5">
                  <Instagram size={20} />
                </a>
                <a href="https://wa.me/5583993913523" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-[#1a1a1a] flex items-center justify-center hover:bg-[#00ff41] hover:text-black transition-all border border-white/5">
                  <MessageCircle size={20} />
                </a>
                <a href="mailto:imaginehub.oficial@gmail.com" className="w-12 h-12 bg-[#1a1a1a] flex items-center justify-center hover:bg-[#00ff41] hover:text-black transition-all border border-white/5">
                  <Mail size={20} />
                </a>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-600">
            <span>© 2025 IMAGINE - ORÇAMENTO DE PEDIDOS</span>
            <span>Paraíba, Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;