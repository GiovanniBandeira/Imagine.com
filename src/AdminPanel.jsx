import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, ShieldAlert, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const AdminPanel = ({ onBack }) => {
  const [models, setModels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tagging, setTagging] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // 1. Validação simples de Senha (Evitar bisbilhoteiros)
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'imagineadmin') {
      setPasswordOk(true);
      fetchAllModels();
    } else {
      alert('Senha incorreta!');
    }
  };

  // 2. Buscar TUDO para o "Tinder"
  const fetchAllModels = async () => {
    setLoading(true);
    let allFetched = [];
    let token = "0";

    try {
      while (token !== null) {
        // Se estiver num ambiente local, pode trocar para localhost se necessário, mas OnRender é mais seguro
        const url = window.location.hostname === 'localhost' 
          ? `http://localhost:3000/api/models?pageToken=${token}` 
          : `https://imagine-com.onrender.com/api/models?pageToken=${token}`;
          
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.models) {
          // A mágica: Só mostra pro Lojista o que ainda NÃO FOI classificado nem como +18 nem como Livre
          const unclassified = data.models.filter(m => !m.isNsfw && !m.isSfw);
          allFetched = [...allFetched, ...unclassified];
        }
        token = data.nextPageToken;
        
        // Atualiza a tela aos poucos para não parecer travado
        setModels([...allFetched]);
      }
    } catch(e) {
      console.error("Erro ao carregar tudo:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Função de Salvar Tag (Deslize do Tinder)
  const handleTag = async (tagType) => {
    if (currentIndex >= models.length) return;
    const currentModel = models[currentIndex];
    setTagging(true);

    try {
       const url = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000/api/admin/tag' 
          : 'https://imagine-com.onrender.com/api/admin/tag';

       const res = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ folderId: currentModel.id, tag: tagType })
       });
       
       const json = await res.json();
       if (json.success) {
         setStatusMsg(`✅ Último: ${currentModel.name} marcado como ${tagType.toUpperCase()}`);
       } else {
         setStatusMsg(`❌ Erro ao marcar ${currentModel.name}`);
       }
    } catch (e) {
       setStatusMsg(`❌ Falha de Rede ao marcar ${currentModel.name}`);
    }

    setTagging(false);
    // Vai pra próxima foto automaticamente!
    setCurrentIndex(prev => prev + 1);
  };

  if (!passwordOk) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-[#1a1a1a] p-8 border border-white/10 space-y-6 max-w-sm w-full">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-[#00ff41]">Acesso Restrito</h2>
          <p className="text-sm text-gray-400">Painel de classificação de conteúdo.</p>
          <input 
            type="password" 
            placeholder="Senha..." 
            value={passwordInput} 
            onChange={e => setPasswordInput(e.target.value)}
            className="w-full bg-black border border-white/20 p-3 outline-none focus:border-[#00ff41]"
          />
          <button type="submit" className="w-full bg-[#00ff41] text-black font-black uppercase p-3 hover:bg-white transition-colors">
            Entrar
          </button>
          <button type="button" onClick={onBack} className="w-full border border-white/20 text-gray-400 uppercase font-black p-3 hover:text-white transition-colors">
            Voltar ao Site
          </button>
        </form>
      </div>
    );
  }

  const currentLabel = models[currentIndex];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-[#08F868] selection:text-black">
      {/* HEADER MODO ESCURO */}
      <header className="w-full bg-[#111] border-b border-white/10 p-4 shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-white/5 hover:bg-[#00ff41] hover:text-black transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                Painel Admin <span className="bg-[#00ff41] text-black text-[10px] px-2 py-1">NSFW AUDIT</span>
              </h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest">
                Você está classificando as fotos do Cloudinary
              </p>
            </div>
         </div>
         <div className="text-right text-xs text-gray-400 font-bold uppercase tracking-widest hidden sm:block">
            {loading ? "Carregando Carga Total..." : `Auditados: ${currentIndex} / ${models.length}`}
         </div>
      </header>
      
      {/* CORPO CENTRAL (TINDER DA AUDITORIA) */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 lg:p-10 relative overflow-hidden">
        
        {loading && models.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-[#00ff41]">
             <Loader2 size={48} className="animate-spin" />
             <p className="font-bold uppercase tracking-widest text-sm animate-pulse">Sincronizando Banco de Dados...</p>
          </div>
        ) : currentIndex >= models.length ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={80} className="text-[#00ff41] mx-auto" />
              <h2 className="text-3xl font-black uppercase tracking-tighter">Auditoria Concluída!</h2>
              <p className="text-gray-400">Você classificou todas as dezenas de pastas com sucesso.</p>
              <button onClick={onBack} className="bg-[#00ff41] text-black px-8 py-3 font-black tracking-widest uppercase hover:bg-white mt-4">
                Voltar à Vitrine
              </button>
            </div>
        ) : (
          <div className="w-full max-w-2xl bg-[#111] border border-white/10 shadow-2xl flex flex-col items-center p-6 space-y-6 relative">
             <div className="text-center space-y-1 w-full relative">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest block">Analisando:</span>
                <h3 className="text-2xl font-black tracking-tighter uppercase break-words px-8">{currentLabel?.name}</h3>
                
                {/* Dica de Botões de teclado para acelerar */}
                <div className="absolute right-0 top-0 text-[10px] text-gray-600 hidden md:block">
                  DICA: Você pode clica com o Mouse
                </div>
             </div>

             {/* FOTO PRINCIPAL DO MODELO */}
             <div className="w-full aspect-square md:aspect-[4/3] bg-black border border-white/5 relative flex items-center justify-center p-2 group">
                 {currentLabel?.images[0] ? (
                    <img 
                      src={currentLabel.images[0].url} 
                      alt={currentLabel.name}
                      className="w-full h-full object-contain"
                    />
                 ) : (
                    <span className="text-gray-600 font-bold">Sem miniatura.</span>
                 )}
                 {currentLabel?.isNsfw && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black uppercase px-3 py-1 animate-pulse">
                      Já marcado como +18
                    </div>
                 )}
                 {tagging && (
                   <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                     <Loader2 size={40} className="text-[#00ff41] animate-spin mb-2" />
                     <p className="text-xs font-bold uppercase tracking-widest text-[#00ff41]">Aplicando Selo...</p>
                   </div>
                 )}
             </div>

             {/* BOTÕES DE CLASSIFICAÇÃO */}
             <div className="flex gap-4 w-full">
                <button 
                   disabled={tagging}
                   onClick={() => handleTag('sfw')}
                   className="flex-1 bg-white/5 hover:bg-white text-gray-400 hover:text-black border border-white/10 p-4 flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50"
                >
                   <CheckCircle2 size={28} className="group-hover:text-[#00ff41]" />
                   <span className="font-black uppercase tracking-widest">LIVRE (SFW)</span>
                </button>
                <button 
                   disabled={tagging}
                   onClick={() => handleTag('nsfw')}
                   className="flex-1 bg-white/5 hover:bg-red-600 text-gray-400 hover:text-white border border-white/10 p-4 flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50"
                >
                   <ShieldAlert size={28} className="group-hover:text-white" />
                   <span className="font-black uppercase tracking-widest">+18 (NSFW)</span>
                </button>
             </div>

             {/* Controles do Carrossel (Pular, Voltar) */}
             <div className="flex items-center justify-between w-full pt-4 border-t border-white/10">
                <button onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} className="text-gray-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase transition-colors">
                  <ChevronLeft size={16}/> Voltar Foto
                </button>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center flex-1 mx-4">
                  {statusMsg || 'Passe as fotos! Suas escolhas refletirão ao vivo na vitrine para os clientes.'}
                </span>
                <button onClick={() => setCurrentIndex(p => p + 1)} className="text-gray-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase transition-colors">
                  Pular <ChevronRight size={16}/>
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminPanel;
