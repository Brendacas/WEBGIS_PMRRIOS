
// MAPA BASE
const map = L.map('map').setView([-14.8, -39.0], 12);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// DECLARAÇÃO DAS CAMADAS
let limiteAlto;
let areaPesquisa;
let contencoes;
let contencoesLineares;
let drenagem;
let redeEsgoto;
let logisticaLixo;
let coletor_residuos;
let mobilidade;
let risco2;
let risco3;
let risco4;
let inundacaorisco2;
let inundacaorisco3;


//  CONFIGURAÇÃO DOS GRUPOS GLOBAIS
const camadasGlobais = {
    limites: L.layerGroup(),
    areaPesquisa: L.layerGroup(),
    contencoes: L.layerGroup(),
    contencoesLineares: L.layerGroup(),
    drenagem: L.layerGroup(),
    esgoto: L.layerGroup(),
    lixo: L.layerGroup(),
    coletor: L.layerGroup(),
    risco2: L.layerGroup(),
    risco3: L.layerGroup(),
    risco4: L.layerGroup(),
    mobilidade: L.layerGroup(),
    inundacaorisco2: L.layerGroup(),
    inundacaorisco3: L.layerGroup()
};
// Inicia com algumas ligadas 
camadasGlobais.limites.addTo(map);
//  SISTEMA DE FILTRO POR ALTO
const bancoDeDadosAltos = {};
const bancoDeDadosInundacoes = {}; 
// Cria o Controle Dropdown no Mapa
const filtroControl = L.control({ position: 'topright' });
filtroControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
        <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 15px rgba(0,0,0,0.2);">
            <label><strong>Filtrar Local:</strong></label><br>
            <select id="seletorAlto" style="width: 160px; margin-top: 5px; padding: 5px;">
                <option value="todos">🔎 VER TODOS</option>
            </select>
        </div>
    `;
    
    // Impede que o clique no select arraste o mapa
    L.DomEvent.disableClickPropagation(div);
    return div;
};
filtroControl.addTo(map);
// Lógica de Troca do Filtro
function aplicarFiltroLocal(nomeSelecionado) {
    // Limpa TODOS os grupos globais 
    Object.values(camadasGlobais).forEach(grupo => grupo.clearLayers());

    // Função auxiliar para recolocar as camadas
    const adicionarAoMapa = (nomeAlto) => {
        if (bancoDeDadosAltos[nomeAlto]) {
            bancoDeDadosAltos[nomeAlto].forEach(item => {
                // Adiciona a camada de volta ao seu grupo original
                item.layer.addTo(item.grupo);
            });
        }
    };

    // Verifica a escolha
    if (nomeSelecionado === "todos") {
        // Adiciona tudo de volta
        Object.keys(bancoDeDadosAltos).forEach(nome => adicionarAoMapa(nome));
        
        // Ajusta o zoom para ver tudo 
    } else {
        // Adiciona apenas o alto específico
        adicionarAoMapa(nomeSelecionado);

        const camadasDoAlto = bancoDeDadosAltos[nomeSelecionado];
        // Procura a camada de Limite dentro desse alto para dar zoom nela
        const camadaLimite = camadasDoAlto.find(c => c.grupo === camadasGlobais.limites);
        if (camadaLimite && map) {
            map.fitBounds(camadaLimite.layer.getBounds());
        }
    }
}
// Evento de mudança no Select
document.addEventListener("change", function(e){
    if(e.target && e.target.id == 'seletorAlto'){
        aplicarFiltroLocal(e.target.value);
    }
});
function onEachFeaturePadrao(feature, layer) {
    let popupContent = "";
    for (let prop in feature.properties) {
        popupContent += `<b>${prop}</b>: ${feature.properties[prop]}<br>`;
    }
    layer.bindPopup(popupContent);
}
function criarInteracaoComMidia(caminhoPastaMidia, funcaoClickTabela) {
    return function (feature, layer) {
        const props = feature.properties;
        const idFicha = props.ficha || props.id;
        
        let htmlPopup = `<div style="min-width:250px; max-width:300px;">`;

        // --- BLOCO DE VÍDEO ---
        if (props.video) {
            const urlVideo = `${caminhoPastaMidia}/${props.video}`;
            htmlPopup += `
                <div style="margin-bottom:10px;">
                    <video width="100%" controls style="border-radius:4px; border: 1px solid #ddd;">
                        <source src="${urlVideo}" type="video/mp4">
                    </video>
                    <small style="color:gray; display:block; text-align:center;">Vídeo Aéreo</small>
                </div>`;
        }

        // --- BLOCO DE FOTO ---
        if (props.foto) {
            const urlFoto = `${caminhoPastaMidia}/${props.foto}`;
            htmlPopup += `
                <div style="margin-bottom:10px;">
                    <img src="${urlFoto}" 
                         style="width:100%; height:auto; border-radius:4px; border: 1px solid #ddd;" 
                         onerror="this.style.display='none'">
                    <small style="color:gray; display:block; text-align:center;">Foto de Campo</small>
                </div>`;
        }

        // --- DADOS TEXTUAIS ---
        let textoDados = "<hr><b>Informações:</b><br>";
        for (let prop in props) {
            if (!['video', 'foto', 'ficha', 'id', 'AltoL'].includes(prop)) {
                textoDados += `<b>${prop}:</b> ${props[prop]}<br>`;
            }
        }
        
        htmlPopup += `<div style="max-height:120px; overflow-y:auto; font-size:12px;">${textoDados}</div>`;
        htmlPopup += `</div>`;

        layer.bindPopup(htmlPopup);

        // Clique para abrir a tabela lateral
        layer.on("click", (e) => {
            if (funcaoClickTabela && idFicha) {
                funcaoClickTabela(`${idFicha}`);
            }
            map.setView(e.latlng, map.getZoom());
        });
    };
}
function carregarAlto({ arquivo, nomeAlto }) {
    console.log(`Carregando: ${nomeAlto}...`);

    if (!bancoDeDadosAltos[nomeAlto]) {
        bancoDeDadosAltos[nomeAlto] = [];
    }

    fetch(arquivo)
        .then(response => response.json())
        .then(data => {

            const processarCamada = (filtro, estilo, grupoDestino, interacaoPersonalizada) => {
                const camada = L.geoJSON(data, {
                    filter: filtro,
                    style: estilo,
                    onEachFeature: interacaoPersonalizada || onEachFeaturePadrao, 
                    pointToLayer: (feature, latlng) => {
                        if (grupoDestino === camadasGlobais.coletor) {
                            return L.circle(latlng, estilo);
                        }
                        return L.marker(latlng);
                    }
                });

                if (Object.keys(camada._layers).length > 0) {
                    camada.addTo(grupoDestino);
                    bancoDeDadosAltos[nomeAlto].push({ layer: camada, grupo: grupoDestino });
                }
            };

            const comparaNome = (prop) => prop && prop.toString().trim().toUpperCase() === nomeAlto.toString().trim().toUpperCase();

            processarCamada(
                f => comparaNome(f.properties.AltoL), 
                { color: "#FF8C69", weight: 4, fill: true, fillOpacity: 0.1 }, 
                camadasGlobais.limites,
                menuSelecaoTabelasLimite
                //criarInteracaoComMidia("dados/Ilheus/Fotos", carregarTabelaIntervencao) 
            );
            processarCamada(
              f=> comparaNome(f.properties.AreaInundacao),
                { color: "#57b2fd", weight: 4, fill: true, fillOpacity: 0.1 }, 
                camadasGlobais.limites
                //menuSelecaoTabelasLimite

            )
            processarCamada(
                f=>["Passarela", "Viela", "Escada"].includes(f.properties.Classe) && 
                    (f.geometry.type.includes("Line") || f.geometry.type.includes("Polygon")),
                (feature) =>{
                    const valor = feature.properties.Classe;
                      let estilo = {
                        weight: 2,
                        fillOpacity: 0.8,
                        color: "#333" // Cor da borda
                    };
                    switch(valor){
                        case "Escada":
                            return {
                                ...estilo,
                                color: "#b8d126",       
                                weight: 6,             
                                dashArray: "2,8",
                                lineCap: "square"
                            }
                        case "Passarela":
                            return{
                                ...estilo,
                                color:"#fa3de1",
                                weight:5,
                                dashArray:" 3,5",
                                lineCap : "butt"
                            }
                        case "Viela":
                            return{
                                ...estilo,
                                color:"#eb9008",
                                weight: 3,
                                lineCap: "round"
                            }
                    }
                }, camadasGlobais.mobilidade
            )

            processarCamada(
                f => ["Praça", "Retaludamento", "Solo Grampeado Verde", "Solo Grampeado"].includes(f.properties.Intervenco || f.properties.Classe), 
                (feature) => {
                    const tipo = feature.properties.Intervenco || feature.properties.Classe;
                    
                    // Configuração base
                    let estilo = {
                        weight: 2,
                        fillOpacity: 0.8,
                        color: "#333" // Cor da borda
                    };

                    switch (tipo) {
                        case "Solo Grampeado Verde":
                        case "Solo Grampeado":
                            return { 
                                ...estilo,
                                color: "#27ae60",
                                fillColor: "url(#dotPattern)", // Aplica o pontilhado
                                fillOpacity: 1 
                            };
                        case "Praça":
                            return { 
                                ...estilo,
                                color: "#2980b9",
                                fillColor: "url(#stripePattern)", // Aplica o tracejado
                                fillOpacity: 1
                            };
                        case "Retaludamento":
                            return { ...estilo, 
                                color: "#e67e22",
                                fillColor: "url(#stripePatternR)",
                                fillOpacity: 3 };
                        default:
                            return { ...estilo, color: "#95a5a6", fillColor: "#95a5a6" };
                    }
                },
                camadasGlobais.contencoes
            );
                        
            processarCamada(f => ["Cortina Atirantada", "Muro de Arrimo", "Muro de arrimo de gravidade"].includes(f.properties.Classe),
            (feature)=>{
                const valor = feature.properties.Classe;

                return{ 
                     color: getCor(valor), 
                     weight: 2,
                     fillOpacity: 0.5 
                };
                }, camadasGlobais.contencoesLineares
            );
            
           processarCamada(
    f => ["Canaleta 1", "Canaleta 2", "Galeria pluvial", "Escadaria dissipadora hidráulica"].includes(f.properties.Drenagem || f.properties.Classe),
    (feature) => {
        const tipo = feature.properties.Drenagem || feature.properties.Classe;
        
        let estilo = {
            weight: 2,
            fillOpacity: 0.8,
            color: "#333",
        };

        switch(tipo) {
            case "Canaleta 1":
                return { 
                    ...estilo, 
                    color: "#3498db",  // Cor da linha fina
                    weight: 1,         
                    opacity: 0.8,
                    className: "linha-seta-drenagem"
                };
            case "Escadaria dissipadora hidráulica":
                return {
                    ...estilo,
                    color: "#0e076d",
                    weight: 6,           // Linha bem grossa
                    dashArray: "2, 8",   // Cria o efeito de "degraus" 
                    lineCap: "square"    // Deixa os pontos quadrados como degraus
                };
            case "Galeria pluvial":
                return { 
                    ...estilo, 
                    color: "#032e4b", 
                    weight: 3,
                    dashArray: "10, 10"  // Traços longos 
                };
                    }
                }, 
                camadasGlobais.drenagem
            );
            
            processarCamada(f => ["150 mm", "Rede Coletora de Esgoto Proposto 150mm"].includes(f.properties.Classe),
                { color: "#79591b", weight: 2, className: "linha-seta-esgoto" }, camadasGlobais.esgoto);
            processarCamada(f => ["REDE ESGOTO 150"].includes(f.properties.Layer), { color: "#996600", weight: 2 }, camadasGlobais.esgoto);
            processarCamada(
                f => ["0", "1", "Logistica do Lixo"].includes(f.properties.Classe) && 
                    (f.geometry.type.includes("Line") || f.geometry.type.includes("Polygon")), 
                { color: "#996633", weight: 2, className: "linha-seta-lixo" }, 
                camadasGlobais.lixo
            );
            processarCamada(f => f.geometry.type === "Point" && ["0", "1"].includes(f.properties.Classe),
            (feature) =>{
                    if(feature.properties.Tamanho == "1000L") return{
                        radius: 10, fillColor:  "#2f8b3e", color: "#000", weight: 1, fillOpacity: 0.9 }
                        else if(feature.properties.Tamanho == "240L")return{
                            radius: 1, fillColor: "#8B3E2F", color: "#000000", weight: 0.5,fillOpacity: 0.9 }
                        }
                    , camadasGlobais.coletor
                );
            processarCamada(
                f => ["A1", "A2", "A3", "A4", "A5"].includes(f.properties.Area_Pesqu),
                { color: "#CCCC00", fillOpacity: 0.2, weight: 2 }, 
                camadasGlobais.areaPesquisa,
               menuSelecaoTabelasArea 
                //criarInteracaoComMidia("dados/Ilheus/Fotos", carregarQuadro)
            );
            processarCamada(
                f => f.properties.grau_risco === "Risco Médio (R2)",
                { color: "#fc6908", weight: 2 },
                camadasGlobais.inundacaorisco2
            );
            processarCamada(
                f => f.properties.grau_risco === "Risco Alto (R3)",
                { color: "#CC0000", weight: 2 },
                camadasGlobais.inundacaorisco3
            );
            processarCamada(
                f => f.properties.Grau_Risco === "Risco Médio (R2)",
                { color: "#FFFF33", weight: 2 },
                camadasGlobais.risco2,
                menuSelecaoTabelas
            );
            processarCamada(
                f => f.properties.Grau_Risco === "Risco Alto (R3)",
                { color: "#CC0000", weight: 2 },
                camadasGlobais.risco3,
                menuSelecaoTabelas 
                //criarInteracaoComMidia("dados/Ilheus/Fotos", carregarTabelaArea) 
            );
            processarCamada(
                f => f.properties.Grau_Risco === "Muito Alto (R4)",
                { color: "#9900CC", weight: 2 },
                camadasGlobais.risco4,
                menuSelecaoTabelas
                //criarInteracaoComMidia("dados/Ilheus/Fotos", carregarTabelaArea) 
            );
        })
        .catch(err => console.error("Erro no GeoJSON:", err));
}

function baixarArquivo(){
    const link = document.createElement("a");
    link.href = "Relatorio_Preços.xlsx";
    link.download = "Relatorio_preços.xlsx";
    link.click();
}
//LISTA E INICIALIZAÇÃO
const listaDeAltos = [
    { nome: "ALTO DO CARVALHO",  arquivo: "dados/Ilheus/GeoJSON/AltoCarvalho.geojson" },
    { nome: "ALTO DA ESPERANÇA", arquivo: "dados/Ilheus/GeoJSON/AltoEsperança.geojson" },
    { nome: "ALTO DO AURELIANO", arquivo: "dados/Ilheus/GeoJSON/AltoAureliano.geojson" },
    {nome: "ESPERANCA", arquivo: "dados/Ilheus/GeoJSON/InundacaoEsperanca.geojson"}
];
// Popula o Dropdown (Select) e carrega os dados
const selectElement = document.getElementById('seletorAlto');

listaDeAltos.forEach(alto => {
    //Cria a opção no dropdown
    const option = document.createElement("option");
    option.value = alto.nome;
    option.text = alto.nome;
    selectElement.appendChild(option);

    // Carrega o GeoJSON
    carregarAlto({
        arquivo: alto.arquivo,
        nomeAlto: alto.nome
    });
    
});
// Preencher tabela
function carregarTabela(nomeArquivo) {
  const caminho = `dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) {
        throw new Error("Arquivo não encontrado: " + nomeArquivo);
      }
      return response.json();
    })
    .then(dados => {

      document.getElementById("t-nome").innerText = dados.nome || "";
      document.getElementById("t-tipo").innerText = dados.tipo || "";
      document.getElementById("t-data").innerText = dados.data || "";
      document.getElementById("t-localidade").innerText = dados.localidade || "";
      document.getElementById("t-endereco").innerText = dados.endereco || "";
      document.getElementById("t-latitude").innerText = dados.latitude || "";
      document.getElementById("t-longitude").innerText = dados.longitude || "";

      // ===== SÍNTESE =====
      const sinteseDiv = document.getElementById("t-sintese");
      let html = "";

      if (dados.sintese?.intro) {
        html += `<p>${dados.sintese.intro}</p>`;
      }

      if (dados.sintese?.itens?.length) {
        html += "<ul>";
        dados.sintese.itens.forEach(item => {
          html += `<li>${item}</li>`;
        });
        html += "</ul>";
      }

      if (dados.sintese?.conclusao) {
        html += `<p>${dados.sintese.conclusao}</p>`;
      }

      sinteseDiv.innerHTML = html;

      // ===== RECOMENDAÇÕES =====
      const recomendacoesDiv = document.getElementById("t-recomendacoes");
      let htmlRec = "";

      if (dados.recomendacoes?.length) {
        htmlRec += "<ul>";
        dados.recomendacoes.forEach(item => {
          htmlRec += `<li>${item}</li>`;
        });
        htmlRec += "</ul>";
      } else {
        htmlRec = "<p>Sem recomendações cadastradas.</p>";
      }

      recomendacoesDiv.innerHTML = htmlRec;

      // ===== OBSERVAÇÕES =====
      document.getElementById("t-observacoes").innerText =
        dados.observacoes || "";
      
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
    document.getElementById("app").classList.remove("com-quadro", "com-area");
    document.getElementById("app").classList.add("com-tabela");

    // IMPORTANTE: Leaflet precisa recalcular o tamanho
    setTimeout(() => {
    map.invalidateSize();
    }, 300);
}
function carregarTabelaArea(nomeArquivo) {
  
  fetch(`/dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`)
    .then(r => r.json())
    .then(dados => {
        document.getElementById("a-localidade").innerText = dados.localidade || "";
        document.getElementById("a-endereco").innerText = dados.endereco || "";
        document.getElementById("a-equipe").innerText = dados.equipe || "";
        document.getElementById("a-data").innerText = dados.data || "";
        document.getElementById("a-denominacao").innerText = dados.denominacao || "";
        document.getElementById("a-latitude").innerText = dados.latitude || "";
        document.getElementById("a-longitude").innerText = dados.longitude || "";
        document.getElementById("a-referencia").innerText = dados.referencia || "";
        document.getElementById("a-regular").innerText = dados.regular || "";
        document.getElementById("a-irregular").innerText = dados.irregular || "";
        document.getElementById("a-inexistente").innerText = dados.inexistente || "";
        document.getElementById("a-canalizado").innerText = dados.canalizado || "";
        document.getElementById("a-fossa").innerText = dados.fossa || "";
        document.getElementById("a-lancadoEncosta").innerText = dados.lancadoEncosta || "";
        document.getElementById("a-lancadoCanal").innerText = dados.lancadoCanal || "";
        document.getElementById("a-inexistenteD").innerText = dados.inexistenteD || "";
        document.getElementById("a-precarioD").innerText = dados.precarioD || "";
        document.getElementById("a-satisfatorioD").innerText = dados.satisfatorioD || "";
        document.getElementById("a-arterial").innerText = dados.arterial || "";
        document.getElementById("a-coletora").innerText = dados.coletora || "";
        document.getElementById("a-local").innerText = dados.local || "";
        document.getElementById("a-becos").innerText = dados.becos || "";
        document.getElementById("a-caminhos").innerText = dados.caminhos || "";
        document.getElementById("a-flexivel").innerText = dados.flexivel || "";
        document.getElementById("a-rigido").innerText = dados.rigido || "";
        document.getElementById("a-intertravado").innerText = dados.intertravado || "";
        document.getElementById("a-paralelepipedo").innerText = dados.paralelepipedo || "";
        document.getElementById("a-npavimentado").innerText = dados.npavimentado || "";
        document.getElementById("a-veicular").innerText = dados.veicular || "";
        document.getElementById("a-veicular4").innerText = dados.veicular4 || "";
        document.getElementById("a-veicular2").innerText = dados.veicular2 || "";
        document.getElementById("a-pe").innerText = dados.pe|| "";
        document.getElementById("a-declividade").innerText = dados.declividade || "";
        document.getElementById("a-inclinacao").innerText = dados.inclinacao || "";
        document.getElementById("a-substrato").innerText = dados.substrato || "";
        document.getElementById("a-depositos").innerText = dados.depositos || "";
        document.getElementById("a-trincasTerreno").innerText = dados.trincasTerreno || "";
        document.getElementById("a-trincasMoradia").innerText = dados.trincasMoradia || "";
        document.getElementById("a-degraus").innerText = dados.degraus || "";
        document.getElementById("a-inclinacaoArvore").innerText = dados.inclinacaoArvore || "";
        document.getElementById("a-inclinacaoPoste").innerText = dados.inclinacaoPoste || "";
        document.getElementById("a-inclinacaoMuros").innerText = dados.inclinacaoMuros || "";
        document.getElementById("a-muros").innerText = dados.muros || "";
        document.getElementById("a-cicatriz").innerText = dados.cicatriz || "";
        document.getElementById("a-lancamento").innerText = dados.lancamentoAguas || "";
        document.getElementById("a-concentracao").innerText = dados.concentracaoFluxo || "";
        document.getElementById("a-fossasAgente").innerText = dados.fossasAgente || "";
        document.getElementById("a-lixo").innerText = dados.lixo || "";
        document.getElementById("a-infraestrutura").innerText = dados.infraestrutura || "";
        document.getElementById("a-aterro").innerText = dados.aterro || "";
        document.getElementById("a-cortesVerticalizados").innerText = dados.cortes || "";
        document.getElementById("a-vegetacaoInadequada").innerText = dados.vegetacaoInadequada || "";
        document.getElementById("a-tubulacaoAgua").innerText = dados.tubulacaoAgua || "";
        document.getElementById("a-tubulacaoEsgoto").innerText = dados.tubulacaoEsgoto || "";
        document.getElementById("a-quedasRolamento").innerText = dados.quedasRolamento || "";
        document.getElementById("a-ravina").innerText = dados.ravina || "";
        document.getElementById("a-alagamento").innerText = dados.alagamento || "";
        document.getElementById("a-erosaoCosteira").innerText = dados.erosaoCosteira || "";
        document.getElementById("a-corridas").innerText = dados.corridas || "";
        document.getElementById("a-rastejo").innerText = dados.rastejo || "";
        document.getElementById("a-vocoroca").innerText = dados.vocoroca || "";
        document.getElementById("a-inundacaoProcessos").innerText = dados.inundacaoProcessos || "";
        document.getElementById("a-deslizamentoRotacional").innerText = dados.deslizamentoRotacional || "";
        document.getElementById("a-deslizamentoTranslacional").innerText = dados.deslizamentoTranslacional || "";
        document.getElementById("a-enxurrada").innerText = dados.enxurrada || "";
        document.getElementById("a-solapamento").innerText = dados.solapamento || "";
        document.getElementById("a-subsidencia").innerText = dados.subsidencia || "";
        document.getElementById("a-colapsos").innerText = dados.colapsos || "";
        document.getElementById("a-materiaisEnvolvidos").innerText = dados.materiaisEnvolvidos || "";
        document.getElementById("a-dimensaoGeo1").innerText = dados.dimensaoGeo1 || "";
        document.getElementById("a-dimensaoGeo2").innerText = dados.dimensaoGeo2 || "";
        document.getElementById("a-dimensaoGeo3").innerText = dados.dimensaoGeo3 || "";
        document.getElementById("a-dimensaoGeo4").innerText = dados.dimensaoGeo4|| "";
        document.getElementById("a-dimensaohidro1").innerText = dados.dimensaohidro1 || "";
        document.getElementById("a-dimensaohidro2").innerText = dados.dimensaohidro2 || "";
        document.getElementById("a-dimensaohidro3").innerText = dados.dimensaohidro3 || "";
        document.getElementById("a-dimensaohidro4").innerText = dados.dimensaohidro4 || "";
        document.getElementById("a-numdomicilios").innerText = dados.numDomicilios || "";
        document.getElementById("a-distanciaEncosta1").innerText = dados.distanciaEncosta1 || "";
        document.getElementById("a-distanciaEncosta2").innerText = dados.distanciaEncosta2 || "";
        document.getElementById("a-distanciaEncosta3").innerText = dados.distanciaEncosta3 || "";
        document.getElementById("a-distanciaEncosta4").innerText = dados.distanciaEncosta4 || "";
        document.getElementById("a-distanciamargem1").innerText = dados.distanciamargem1 || "";
        document.getElementById("a-distanciamargem2").innerText = dados.distanciamargem2 || "";
        document.getElementById("a-distanciamargem3").innerText = dados.distanciamargem3 || "";
        document.getElementById("a-distanciamargem4").innerText = dados.distanciamargem4 || "";
        document.getElementById("a-plastMadLa").innerText = dados.plastMadLa || "";
        document.getElementById("a-madeira").innerText = dados.madeira || "";
        document.getElementById("a-alvenaria").innerText = dados.alvenaria || "";
        document.getElementById("a-mista").innerText = dados.mista || "";
        document.getElementById("a-tipoBaixa").innerText = dados.tipoBaixa || "";
        document.getElementById("a-tipoMedia").innerText = dados.tipoMedia || "";
        document.getElementById("a-tipoAlta").innerText = dados.tipoAlta || "";
        //document.getElementById("a-observacoes").innerText = dados.observacoes || "";
        const observacoesDiv = document.getElementById("a-observacoes");
        let htmlO = "";

        if (dados.observacoes?.itens?.length) {
          htmlO += "<ul>";
          dados.observacoes.itens.forEach(item => {
            htmlO += `<li>${item}</li>`;
          });
          htmlO += "</ul>";
        }

        observacoesDiv.innerHTML = htmlO;
        document.getElementById("app").classList.add("com-area");
        document.getElementById("painel-area").style.display = "block";

        // Verifica se a tela é grande (desktop) para mover os controles
        if (window.innerWidth > 800) {
            // Pega o container dos controles da direita (camadas e filtro)
            const controlesDireita = document.querySelector(".leaflet-right");
            if (controlesDireita) {
                // Empurra eles para a esquerda 
                controlesDireita.style.marginRight = "600px"; 
                controlesDireita.style.transition = "margin-right 0.3s";
            }
        }

      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    });
}
function carregarQuadro(nomeArquivo) {

  const caminho = `/dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) {
        throw new Error("Arquivo não encontrado: " + nomeArquivo);
      }
      return response.json();
    })
    .then(dados => {

      document.getElementById("q-municipio").innerText = dados.municipio || "";
      document.getElementById("q-bairro").innerText = dados.bairro || "";
      document.getElementById("q-equipe").innerText = dados.equipe || "";
      document.getElementById("q-data").innerText = dados.data || "";
      document.getElementById("q-denominacao").innerText = dados.denominacao || "";
      document.getElementById("q-latitude").innerText = dados.latitude || "";
      document.getElementById("q-longitude").innerText = dados.longitude || "";
      document.getElementById("q-referencia").innerText = dados.referencia || "";

      // ===== Carta =====
      const cartaDiv = document.getElementById("q-carta");
      let html = "";

      if (dados.carta?.itens?.length) {
        html += "<ul>";
        dados.carta.itens.forEach(item => {
          html += `<li>${item}</li>`;
        });
        html += "</ul>";
      }

      cartaDiv.innerHTML = html;

      // ===== OBSERVAÇÕES =====
      document.getElementById("q-observacoes").innerText =
        dados.observacoes || "";

      // ABRE O PAINEL SÓ AGORA
      document.getElementById("app").classList.remove("com-tabela", "com-area", "com-tabelaIntervencao");
      document.getElementById("app").classList.add("com-quadro");

      // Leaflet recalcula tamanho
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
    
    
}
function carregarTabelaIntervencao(nomeArquivo) {
  const caminho = `/dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) {
        throw new Error("Arquivo não encontrado: " + nomeArquivo);
      }
      return response.json();
    })
    .then(dados => {
        document.getElementById("i-municipio").innerText = dados.municipio || "";
        document.getElementById("i-bairro").innerText = dados.bairro || "";
        document.getElementById("i-equipe").innerText = dados.equipe || "";
        document.getElementById("i-data").innerText = dados.data || "";
        document.getElementById("i-denominacao").innerText = dados.denominacao || "";
        document.getElementById("i-coordenadas").innerText = dados.coordenadas || "";
        document.getElementById("i-referencias").innerText = dados.referencias || "";
        document.getElementById("i-ndomicilios").innerText = dados.ndomicilios || "";
        document.getElementById("i-grau").innerText = dados.graurisco || "";
        document.getElementById("i-necessidades").innerText = dados.necessidades || "";
        document.getElementById("i-observacoesAdicionais").innerText = dados.obsAdicionais || "Sem observações";
        document.getElementById("i-demolicao").innerText = dados.demolicao || "";
        document.getElementById("i-servicoLimpeza").innerText = dados.servicoLimpeza || "";
        document.getElementById("i-MuroArimo").innerText = dados.muroArimo || "";
        document.getElementById("i-SBN").innerText = dados.sbn || "";
        document.getElementById("i-observacoes").innerText = dados.observacoes || "Sem observações";
        document.getElementById("i-custoEstimado").innerText = dados.custoEstimado || "";
        document.getElementById("i-projetoExecutivo").innerText = dados.projetoExecutivo || "";
        document.getElementById("i-servicosPreliminares").innerText = dados.servicosPreliminares || "";
        document.getElementById("i-equipamentosMonitoramento").innerText = dados.equipamentoMonitoramento || "";
        document.getElementById("i-acoesSociais").innerText = dados.acoesSociais || "";
        document.getElementById("i-avaliacaoPos").innerText = dados.avaliacaoPos || "";
        document.getElementById("i-subTotal").innerText = dados.subTotal || "";
        document.getElementById("i-bdi").innerText = dados.bdi || "";
        document.getElementById("i-custoTotal").innerText = dados.custoTotal || "";

        // Remova TODAS as classes de painéis conhecidos antes de abrir o novo
        //document.getElementById("app").classList.remove("com-tabela", "com-area", "com-quadro");

        document.getElementById("app").classList.add("com-tabelaIntervencao");

      // Leaflet recalcula tamanho
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
}
function carregarOrcamentoLim(nomeArquivo) {
  const caminho = `/dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) throw new Error("Arquivo não encontrado: " + nomeArquivo);
      return response.json();
    })
    .then(dados => {
      // Preenchimento de Campos de Cabeçalho 
      const infoGeral = dados[0] || {};
      
      // Mapeamento de IDs 
      const elementos = {
       //"o-codAlto": infoGeral.CODIGO_ALTO,
        "o-descricao": infoGeral["DESCRIÇÃO DO ITEM"],
        "o-soma": infoGeral.Soma 
      };

      // Atualiza o DOM apenas se o elemento existir
      Object.keys(elementos).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = elementos[id] || "";
      });

      // 2. Construção da Tabela Dinâmica
      const corpoTabela = document.getElementById("corpo-tabela-orcamentoLim"); 
      if (corpoTabela) {
        corpoTabela.innerHTML = ""; // Limpa a tabela antes de carregar

        dados.forEach(linha => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${linha.ITEM || ""}</td>
            <td>${linha["DESCRIÇÃO DO ITEM"] || ""}</td>
            <td>${linha.soma_parcial ? linha.soma_parcial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
            <td>${linha["Parcial (%)"] || ""}</td>
            <td>${linha["Soma"] ? linha["Soma"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
          `;
          corpoTabela.appendChild(tr);
        });
      }

      // 3. Gestão de Layout e Mapa
      const app = document.getElementById("app");
      app.classList.remove(    "com-tabela",
                                "com-area",
                                "com-quadro",
                                "com-tabelaIntervencao",
                                "com-planilha-orcamento",
                                "com-OrcamentoRisco",
                                "com-OrcamentoArea");
      app.classList.add("com-OrcamentoLim");

       setTimeout(() => {
        map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
}
function carregarOrcamentoRisco(nomeArquivo) {
    const caminho = `dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) throw new Error("Arquivo não encontrado: " + nomeArquivo);
      return response.json();
    })
    .then(dados => {
      // Preenchimento de Campos de Cabeçalho 
      const infoGeral = dados[0] || {};
      
      // Mapeamento de IDs 
      const elementos = {
       "o-codAlto": infoGeral.CODIGO_ALTO,
        "o-descricao": infoGeral["DESCRIÇÃO DO ITEM"],
        "o-soma": infoGeral.Soma 
      };

      // Atualiza o DOM apenas se o elemento existir
      Object.keys(elementos).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = elementos[id] || "";
      });

      // 2. Construção da Tabela Dinâmica
      const corpoTabela = document.getElementById("corpo-tabela-orcamentoRisco"); 
      if (corpoTabela) {
        corpoTabela.innerHTML = ""; // Limpa a tabela antes de carregar

        dados.forEach(linha => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${linha.CODIGO_ALTO || ""}</td>
            <td>${linha.CODIGO_ORSE || ""}</td>
            <td>${linha.ITEM || ""}</td>
            <td>${linha["DESCRIÇÃO DO ITEM"] || ""}</td>
            <td>${linha.UNID || ""}</td>
            <td>${linha.QUANT || 0}</td>
            <td>${linha.PRECO_UNIT ? linha.PRECO_UNIT.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
            <td>${linha["Valor Parcial"] ? linha["Valor Parcial"].toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : "-"}</td>
            <td>${linha.soma_parcial ? linha.soma_parcial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
            <td>${linha["Parcial (%)"] || ""}</td>
            <td>${linha["Soma"] ? linha["Soma"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
          `;
          corpoTabela.appendChild(tr);
        });
      }

      // 3. Gestão de Layout e Mapa
      const app = document.getElementById("app");
      app.classList.remove("com-tabela", "com-area", "com-quadro", "com-tabelaIntervencao");
      app.classList.add("com-OrcamentoRisco");

      setTimeout(() => {
        if (typeof map !== 'undefined') map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
}
function carregarOrcamentoArea(nomeArquivo) {
    const caminho = `dados/Ilheus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) throw new Error("Arquivo não encontrado: " + nomeArquivo);
      return response.json();
    })
    .then(dados => {
      // Preenchimento de Campos de Cabeçalho 
      const infoGeral = dados[0] || {};
      
      // Mapeamento de IDs 
      const elementos = {
       "o-codAlto": infoGeral.CODIGO_ALTO,
        "o-descricao": infoGeral["DESCRIÇÃO DO ITEM"],
        "o-soma": infoGeral.Soma 
      };

      // Atualiza o DOM apenas se o elemento existir
      Object.keys(elementos).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = elementos[id] || "";
      });

      // 2. Construção da Tabela Dinâmica
      const corpoTabela = document.getElementById("corpo-tabela-orcamentoArea"); 
      if (corpoTabela) {
        corpoTabela.innerHTML = ""; // Limpa a tabela antes de carregar

        dados.forEach(linha => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${linha.CODIGO_ALTO || ""}</td>
            <td>${linha.ITEM || ""}</td>
            <td>${linha["DESCRIÇÃO DO ITEM"] || ""}</td>
    
            <td>${linha["Soma"] ? linha["Soma"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
          `;
          corpoTabela.appendChild(tr);
        });
      }

      // 3. Gestão de Layout e Mapa
      const app = document.getElementById("app");
      app.classList.remove("com-tabela", "com-area", "com-quadro", "com-tabelaIntervencao");
      app.classList.add("com-OrcamentoArea");

      setTimeout(() => {
        if (typeof map !== 'undefined') map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
}
function fecharTabela() {
  const app = document.getElementById("app");

  // 1. Remove as classes que ajustam o tamanho do mapa (Layout)
  app.classList.remove(
    "com-tabela",
    "com-area",
    "com-quadro",
    "com-tabelaIntervencao",
    "com-planilha-orcamento",
    "com-OrcamentoLim",
    "com-OrcamentoRisco",
    "com-OrcamentoArea"
  );

  // 2. FORÇA O O ELEMENTO A SUMIR 
  const painelArea = document.getElementById("painel-area");
  if (painelArea) {
      painelArea.style.display = "none";
  }

  // Devolve os controles para o lugar original (canto direito)
    const controlesDireita = document.querySelector(".leaflet-right");
    if (controlesDireita) {
        controlesDireita.style.marginRight = "0px";
    }

  // 3. Atualiza o tamanho do mapa
  setTimeout(() => {
    if (window.map) map.invalidateSize();
  }, 300);
}
let controleCamadas;
function ativarCamadas() {

    if (!controleCamadas) {
        controleCamadas = L.control.layers(
            {},
            {
                "Limites dos Altos": camadasGlobais.limites,
                "Área de Pesquisa": camadasGlobais.areaPesquisa,
                "Contenções": camadasGlobais.contencoes,
                "Contenções Lineares": camadasGlobais.contencoesLineares,
                "Drenagem": camadasGlobais.drenagem,
                "Rede de Esgoto": camadasGlobais.esgoto,
                "Logística do Lixo": camadasGlobais.lixo,
                "Coletores": camadasGlobais.coletor,
                "Risco Médio (R2)": camadasGlobais.risco2,
                "Risco Alto (R3)": camadasGlobais.risco3,
                "Risco Muito Alto (R4)": camadasGlobais.risco4,
                "Mobilidade": camadasGlobais.mobilidade,
                "Inundações Risco2": camadasGlobais.inundacaorisco2,
                "Inundações Risco3": camadasGlobais.inundacaorisco3
            },
            { collapsed: false }
        );

        controleCamadas.addTo(map);

        // ⬇️ Move o controle para dentro do sidebar
        const controleEl = controleCamadas.getContainer();
        document.getElementById("camadas-container").appendChild(controleEl);
    }

    // toggle de visibilidade
    const container = document.getElementById("camadas-container");
    container.style.display =
        container.style.display === "none" ? "block" : "none";
}
function getCor(valor) {
    switch (valor) {
        case "Cortina Atirantada":                return "rgba(245, 84, 20, 0.93)";
        case "Muro de Arrimo":                    return "rgba(203, 42, 235, 0.93)";
        default:                                  return "#660000"; // Cor padrão
    }
}
function menuSelecaoTabelas(feature, layer) {
    const props = feature.properties;
    // Transformamos o objeto em uma string JSON segura para HTML
    const propsString = JSON.stringify(props).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    const conteudo = `
        <div class="popup-menu">
            <strong>Setor: ${props.Area_Pesqu}</strong><br><br>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('caracterizacao', ${propsString})">⚠️ Ficha de Caracterização do Setor de Risco</button>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('intervencao', ${propsString})">📋 Quadro de Intervenções do Setor de Risco</button>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('orcamento', ${propsString})">📋 Tabela orçamento</button>
        </div>
    `;
    layer.bindPopup(conteudo);
}
function menuSelecaoTabelasLimite(feature, layer) {
    const props = feature.properties;
    // Transformamos o objeto em uma string JSON segura para HTML
    const propsString = JSON.stringify(props).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    const conteudo = `
        <div class="popup-menu">
            <strong>Alto: ${props.AltoL}</strong><br><br>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('caracterizaçãoL', ${propsString})">⚠️ Ficha de Caracterização da Zona de Intervenção</button>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('orcamento', ${propsString})">📋 Visualizar Tabela Orçamentária </button>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('baixar', ${propsString})">Baixar Tabela Orçamentária</button>
        </div>
    `;
    layer.bindPopup(conteudo);
}
function menuSelecaoTabelasArea(feature, layer) {
    const props = feature.properties;
    // Transformamos o objeto em uma string JSON segura para HTML
    const propsString = JSON.stringify(props).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    const conteudo = `
        <div class="popup-menu">
            <strong>Area: ${props.Area_Pesqu}</strong><br><br>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('caracterizaçãoA', ${propsString})">⚠️ Ficha de caracterização da Área de Pesquisa</button>
            <button class="btn-popup" onclick="abrirQuadroEspecifico('orcamento', ${propsString})">📋 Tabela orçamento</button>
        </div>
    `;
    layer.bindPopup(conteudo);
}
window.abrirQuadroEspecifico = function(tipo, props) {
    //Limpeza total de estados anteriores
    fecharTabela(); 
    document.getElementById("app").className = ""; // Limpa classes do app

    //Lógica para definir qual arquivo carregar
    let nomeArquivo = "";
    console.log("Valor atual de tipo:", tipo); 

    if(tipo == "caracterizaçãoA") {
        nomeArquivo = props.fichaArea; // "Quadro"....".json"
        
        const painel = document.getElementById('painel-quadro5');
        if (painel) painel.style.display = 'block';
        
        if (typeof window.carregarQuadro === "function") {
            window.carregarQuadro(nomeArquivo);
        }
    }
        
    else if(tipo == "caracterizaçãoL") {
        nomeArquivo = props.fichaAlto; // "Quadro"....".json"
        
        const painel = document.getElementById('painel-tabela');
        if (painel) painel.style.display = 'block';
        
        if (typeof window.carregarTabela === "function") {
            window.carregarTabela(nomeArquivo);
        }
    }
    else if (tipo === "caracterizacao") {
        nomeArquivo = props.fichaSetor; // "AltoCarvalho_A1S1R3.json"
        
        const painel = document.getElementById('painel-area');
        if (painel) painel.style.display = 'block';
        
        if (typeof window.carregarTabelaArea === "function") {
            window.carregarTabelaArea(nomeArquivo);
        }
    } 
    else if (tipo === "intervencao") {
        nomeArquivo = props.fichaInter; // "AltoCarvalho_interA1S1R3.json"
        
        const painel = document.getElementById('painel-intervencoes');
        if (painel) painel.style.display = 'block';
        
        if (typeof window.carregarTabelaIntervencao === "function") {
            window.carregarTabelaIntervencao(nomeArquivo);
        }
    }
    else if (tipo === "orcamento") {
        nomeArquivo = props.fichaOrc; 
        
        //const painel = document.getElementById('planilha-orcamentoArea');
       // if (painel) painel.style.display = 'block';
        
        console.log("Tentando carregar arquivo:", nomeArquivo);
        if(nomeArquivo == "OrcLimites.json"){
                window.carregarOrcamentoLim(nomeArquivo);
        }else if(nomeArquivo == "OrcAreaRisco.json"){
            window.carregarOrcamentoRisco(nomeArquivo);
        }else if(nomeArquivo == "OrcArea.json"){
            window.carregarOrcamentoArea(nomeArquivo);
        }else{
            console.error("Erro: window.carregarTabelaOrcamentonão foi encontrada!");
        }
    }
    else if(tipo == "baixar"){
        window.baixarArquivo();
    }
    
    if (map) map.closePopup();  
};

