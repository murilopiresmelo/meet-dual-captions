<p align="center">
  <img src="assets/mascot.png" width="260" alt="Legê, mascote do Meet Dual Captions">
</p>

<h1 align="center">Meet Dual Captions</h1>

<p align="center">
  <strong>Uma reunião, duas legendas e bem menos “aham… claro… entendi tudo”.</strong>
</p>

O **Meet Dual Captions** é uma extensão gratuita para Chrome, Chromium e Microsoft Edge que mostra a legenda original em inglês e sua tradução em português diretamente no Google Meet.

A tradução acontece localmente no navegador com Bergamot e WebAssembly. Não existe conta premium, cota paga de uso, chave de API ou botão dizendo “comece grátis” e pedindo seu cartão três telas depois.

O mascote é o **Legê**: poliglota, cafeinado e contratualmente proibido de avisar que você está no mudo.

## Qual é o objetivo?

Reuniões em outro idioma já exigem atenção suficiente. Ficar alternando entre legenda, tradutor e a expressão facial de quem está fingindo que acompanhou tudo não ajuda.

O projeto existe para:

- manter inglês e português visíveis ao mesmo tempo;
- traduzir sem enviar o texto para um serviço externo;
- evitar troca de abas durante a reunião;
- oferecer personalização sem transformar legenda em painel de avião;
- ser aberto e gratuito para estudar, usar e melhorar.

O fluxo atual é voltado para reuniões faladas em **inglês**, com tradução local para **português**.

## É gratuito mesmo?

Sim.

```text
Preço: R$ 0,00
Mensalidade: R$ 0,00
Limite de reuniões: nenhum
Cafezinho para o Legê: opcional, porém moralmente recomendado
```

Não há versão “Pro”, marca-d'água, anúncios, limite de cinco reuniões por mês ou plano “Enterprise — fale conosco para descobrir o preço”.

O código próprio usa a [Licença MIT](LICENSE), que permite usar, estudar, copiar, modificar e distribuir o software, inclusive comercialmente, preservando o aviso de copyright e a licença. O Bergamot e o modelo incluído usam MPL-2.0; os detalhes estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## O que a extensão oferece?

- legenda original em inglês;
- tradução em português logo abaixo;
- tradução local com modelo Bergamot EN→PT;
- processamento em WebAssembly;
- alinhamento centralizado ou à esquerda;
- cor e tamanho independentes para cada idioma;
- ativação e desativação pelo menu do Google Meet;
- diagnóstico técnico e métricas locais de latência;
- funcionamento sem API externa de tradução;
- nenhuma permissão de microfone, câmera ou captura de áudio.

## Como funciona?

A extensão não escuta a reunião. Ela lê o texto que o próprio Google Meet já colocou na tela como legenda instantânea.

```text
Legenda instantânea renderizada pelo Google Meet
                        ↓
       content.js encontra e acompanha o texto
                        ↓
       service worker coordena a solicitação
                        ↓
       documento offscreen mantém o tradutor
                        ↓
        Bergamot + WASM + modelo local EN→PT
                        ↓
        overlay exibe inglês e português
```

### O caminho completo, sem fumaça de palco

1. O `manifest.json` carrega os scripts somente em páginas `https://meet.google.com/*`.
2. O `content.js` cria um overlay acessível e observa mudanças no DOM do Meet com `MutationObserver`.
3. A extensão procura a região real das legendas, inclusive em shadow roots, e ignora botões, notificações, controles e o próprio overlay.
4. O idioma é estimado pelo texto e, quando possível, pela configuração de idioma selecionada no Meet. É uma heurística de legenda, não leitura de mente nem análise de áudio.
5. Se o Meet estiver no modo de legenda traduzida, a extensão tenta voltar para a legenda instantânea, que fornece a fonte limpa usada pelo tradutor local.
6. A legenda mais recente vira uma solicitação enviada ao service worker em `background.js`.
7. O service worker cria um documento offscreen e encaminha a solicitação para `translator-host.js`.
8. O host carrega o runtime Bergamot, o WebAssembly, o modelo EN→PT, o vocabulário e a lista lexical armazenados dentro da própria extensão.
9. A resposta volta pelos canais internos do Chrome e aparece no overlay: inglês em cima, português embaixo.
10. Ao desligar a extensão, perder a região válida ou não encontrar texto utilizável, a legenda nativa do Meet volta a aparecer.

### Por que a tradução não cria uma fila quilométrica?

Durante uma fala, o Meet atualiza a mesma frase várias vezes. Traduzir todas as versões produziria algo assim:

```text
“Precisamos…”
“Precisamos revisar…”
“Precisamos revisar o orçamento…”
“Aliás, já mudamos de assunto faz dois minutos.”
```

Para evitar isso, o agendador mantém:

- uma tradução ativa;
- somente a legenda pendente mais recente;
- identificadores sequenciais para ignorar respostas antigas.

Uma solicitação já iniciada não é cancelada, mas resultados ultrapassados não substituem a frase atual. A prioridade é acompanhar a reunião, não fazer arqueologia de legenda.

## Instalação

Não existe etapa de compilação para usar a extensão. A pasta do repositório já contém os arquivos necessários.

1. Baixe o projeto em **Code → Download ZIP** e descompacte o arquivo.
2. Abra uma destas páginas:

   - Chrome ou Chromium: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`

3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta que contém `manifest.json`.
6. Recarregue qualquer aba do Google Meet que já estivesse aberta.

Pronto. Nenhum instalador suspeito, nenhuma barra de ferramentas aparecendo do nada e, esperamos, nenhum sobrinho perguntando por que o computador ficou em russo.

## Como usar

1. Entre em uma reunião no Google Meet.
2. Ative as **legendas instantâneas** do Meet.
3. Configure o idioma falado como inglês, quando essa opção estiver disponível.
4. Abra o menu de três pontos da reunião.
5. Mantenha **Legendas duplas — Ligadas**.
6. Clique no ícone do Legê para personalizar:

   - alinhamento centralizado ou à esquerda;
   - cor da legenda em inglês;
   - cor da legenda em português;
   - tamanho de cada idioma, entre 14 e 40 px.

Para voltar à legenda nativa, use o mesmo item do menu e deixe **Legendas duplas — Desligadas**.

## Privacidade

Depois de lido no DOM do Meet, o texto não sai do navegador nem vai para um serviço externo: ele passa pelos componentes locais da extensão e pelo overlay exibido na página. O modelo também é carregado de arquivos locais; o runtime não chama uma API de tradução.

O texto existe temporariamente na memória e no DOM da aba para poder ser exibido e diagnosticado, mas não é persistido em `chrome.storage`, `localStorage`, arquivos ou banco de dados, nem enviado para serviços externos pelo projeto.

O que fica salvo:

- cores, tamanhos e alinhamento em `chrome.storage.local`;
- estado ligado/desligado no `localStorage` da página do Meet.

O projeto não:

- acessa microfone, câmera ou áudio da reunião;
- mantém histórico das falas;
- exige login próprio;
- usa chave de API;
- possui backend ou telemetria;
- transforma a conversa em `reuniao_final_agora_vai_7.xlsx`.

Em reuniões confidenciais, revise o código antes de usar. Confiança é boa; software aberto que você pode inspecionar é melhor.

## Desempenho

O runtime e os arquivos do modelo somam aproximadamente 41 MB e são carregados localmente. A primeira utilização inclui inicialização e aquecimento do modelo, então pode ser mais lenta que as traduções seguintes.

A extensão mantém as 20 latências mais recentes e calcula p50, p95 e máximo. O diagnóstico considera p95 abaixo de 500 ms como orçamento desejado, não como promessa contratual escrita pelo Legê de gravata.

## Diagnóstico

Se a extensão não encontrar a legenda ou a tradução não aparecer, abra o console da página do Meet e execute:

```js
JSON.parse(document.querySelector("#meet-dual-captions")?.dataset.debug || "{}")
```

O objeto pode informar:

- versão e build;
- se a extensão está ligada;
- região de legendas e quantidade de candidatos encontrados;
- idioma detectado e texto usado como fonte;
- estado do service worker e do tradutor;
- tempo de aquecimento do modelo;
- latência da tradução e p95 recente;
- eventuais erros do runtime local.

O diagnóstico pode conter texto da legenda atual. Remova informações confidenciais antes de publicar uma captura ou abrir uma issue.

## Estrutura principal

```text
.
├── manifest.json              Configuração Manifest V3 e permissões
├── content.js                 Leitura do Meet, fila e overlay bilíngue
├── content.css                Aparência e posicionamento das legendas
├── background.js              Coordenação do documento offscreen
├── translator-host.html       Ambiente offscreen do tradutor
├── translator-host.js         Inicialização e uso do Bergamot
├── caption-settings.js        Validação das preferências visuais
├── translation-metrics.js     p50, p95, máximo e orçamento de latência
├── popup.html                 Painel de personalização com o Legê
├── models/bergamot/en-pt/     Modelo, vocabulário e lista lexical EN→PT
├── vendor/bergamot/           Runtime Bergamot e WebAssembly
└── test/                      Testes automatizados
```

## Desenvolvimento

O Node.js é necessário apenas para trabalhar no código e executar as verificações:

```sh
npm ci
npm test
npm run check
```

A suíte usa o test runner nativo do Node.js e cobre, entre outros pontos:

- detecção de inglês e português;
- seleção da legenda-fonte;
- descarte de traduções pendentes antigas;
- ordenação inglês em cima e português embaixo;
- atualização incremental das frases;
- posicionamento do overlay;
- validação das preferências;
- estado e texto do controle no menu do Meet.

Não existe uma etapa de build: JavaScript, CSS, HTML, WASM e o modelo são carregados diretamente pela extensão.

## Limites honestos

- Funciona somente em `meet.google.com`.
- Requer um navegador Chromium com suporte a extensões Manifest V3 e documentos offscreen.
- As legendas instantâneas precisam estar ativadas.
- O modelo embarcado traduz apenas inglês para português.
- Português → inglês não está disponível neste pacote.
- A detecção de idioma é heurística; frases curtas, misturadas ou ambíguas podem ser classificadas incorretamente.
- O item de ativação reconhece atualmente os menus **Settings** e **Configurações**; outros idiomas de interface podem não exibi-lo.
- O Meet não oferece uma API pública estável para esse fluxo. Mudanças no DOM, nos seletores ou no comportamento offscreen podem exigir manutenção.
- A instalação é manual; o projeto não está publicado na Chrome Web Store.
- A tradução é local, mas a reunião do Google Meet obviamente ainda precisa de internet. O Legê é talentoso, não mágico.

## Licenças e componentes de terceiros

O código próprio está sob [MIT](LICENSE): gratuito para uso pessoal, acadêmico e comercial, com permissão para copiar, modificar e distribuir conforme os termos da licença.

O runtime Bergamot e o modelo EN→PT estão sob MPL-2.0. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e [THIRD_PARTY_LICENSES/MPL-2.0.txt](THIRD_PARTY_LICENSES/MPL-2.0.txt).

A arte do mascote foi fornecida para uso neste projeto, mas não está incluída na MIT do código sem confirmação separada dos direitos autorais.

## Contribuições

Correções, melhorias e ideias são bem-vindas. Se o Meet mudar o DOM novamente, não entre em pânico: abra uma issue, descreva o comportamento observado e inclua o diagnóstico já higienizado.

Este é um projeto independente e não oficial. Não é afiliado, patrocinado ou mantido pelo Google.

---

<p align="center">
  Feito para aproximar idiomas — não para criar mais uma assinatura mensal.
</p>
