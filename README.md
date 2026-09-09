<p align="center">
  <img src="assets/mascot.png" width="260" alt="Legê, mascote do Meet Dual Captions">
</p>

<h1 align="center">Meet Dual Captions</h1>

<p align="center">
  <strong>Uma reunião, duas legendas e bem menos “aham… claro… entendi tudo”.</strong>
</p>

O **Meet Dual Captions** é uma extensão gratuita para Chrome, Chromium e Microsoft Edge que mostra simultaneamente legendas em inglês e português, traduzindo nos dois sentidos diretamente no Google Meet.

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

O fluxo atual atende reuniões faladas em **inglês ou português**, com tradução local para o outro idioma.

## É gratuito mesmo?

Sim.

```text
Preço: R$ 0,00
Mensalidade: R$ 0,00
Limite de reuniões: nenhum
Cafezinho para o Legê: opcional, porém moralmente recomendado
```

Não há versão “Pro”, marca-d'água, anúncios, limite de cinco reuniões por mês ou plano “Enterprise — fale conosco para descobrir o preço”.

O código próprio usa a [Licença MIT](LICENSE), que permite usar, estudar, copiar, modificar e distribuir o software, inclusive comercialmente, preservando o aviso de copyright e a licença. O Bergamot e os modelos incluídos usam MPL-2.0; os detalhes estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## O que a extensão oferece?

- inglês em cima e português embaixo;
- tradução local com modelos Bergamot EN→PT e PT→EN;
- processamento em WebAssembly;
- alinhamento centralizado ou à esquerda;
- cor e tamanho independentes para cada idioma;
- ativação e desativação pelo painel da extensão ou menu do Google Meet;
- histórico temporário com participante, fala original e tradução sob demanda;
- histórico flutuante: arraste pelo cabeçalho e solte na lateral para dividir a tela;
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
       Bergamot + WASM + modelos EN→PT e PT→EN
                        ↓
   overlay exibe as legendas e o histórico opcional
```

### O caminho completo, sem fumaça de palco

1. O `manifest.json` carrega os scripts somente em páginas `https://meet.google.com/*`.
2. O `content.js` cria um overlay acessível e observa mudanças no DOM do Meet com `MutationObserver`.
3. A extensão procura a região real das legendas, inclusive em shadow roots, e ignora botões, notificações, controles e o próprio overlay.
4. O idioma é estimado pelo texto e, quando possível, pela configuração de idioma selecionada no Meet. É uma heurística de legenda, não leitura de mente nem análise de áudio.
5. Se o Meet estiver no modo de legenda traduzida, a extensão tenta voltar para a legenda instantânea, que fornece a fonte limpa usada pelo tradutor local.
6. A legenda mais recente vira uma solicitação enviada ao service worker em `background.js`.
7. O service worker cria um documento offscreen e encaminha a solicitação para `translator-host.js`.
8. O host carrega o runtime Bergamot, o WebAssembly e o modelo da direção detectada, armazenados dentro da própria extensão.
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

Ao atualizar a extensão, recarregue novamente a aba do Meet. O painel avisa quando a aba ainda está usando uma versão antiga do script.

Pronto. Nenhum instalador suspeito, nenhuma barra de ferramentas aparecendo do nada e, esperamos, nenhum sobrinho perguntando por que o computador ficou em russo.

## Como usar

1. Entre em uma reunião no Google Meet.
2. Ative as **legendas instantâneas** do Meet.
3. Configure o idioma falado como inglês ou português, quando essa opção estiver disponível.
4. Clique no ícone do Legê e mantenha **Legendas duplas** ligada.
5. Ative **Histórico temporário** para listar participantes e falas somente nesta aba.
6. Passe o mouse sobre uma fala, use o foco do teclado ou toque nela para abrir a tradução.
7. No mesmo painel, personalize:

   - alinhamento centralizado ou à esquerda;
   - cor da legenda em inglês;
   - cor da legenda em português;
   - tamanho de cada idioma, entre 14 e 40 px.

Os mesmos dois controles também aparecem no menu de três pontos do Meet. Para voltar à legenda nativa, desligue **Legendas duplas** em qualquer um dos dois lugares.

## Privacidade

Depois de lido no DOM do Meet, o texto não sai do navegador nem vai para um serviço externo: ele passa pelos componentes locais da extensão e pelo overlay exibido na página. Os modelos também são carregados de arquivos locais; o runtime não chama uma API de tradução.

O texto e o histórico opcional existem temporariamente na memória e no DOM da aba para poderem ser exibidos, mas não são persistidos em `chrome.storage`, `localStorage`, arquivos ou banco de dados, nem enviados para serviços externos pelo projeto. Ao fechar ou trocar de reunião, a lista é descartada.

O que fica salvo:

- cores, tamanhos e alinhamento em `chrome.storage.local`;
- estado ligado/desligado no `localStorage` da página do Meet.

O projeto não:

- acessa microfone, câmera ou áudio da reunião;
- grava o histórico das falas fora da aba da reunião;
- exige login próprio;
- usa chave de API;
- possui backend ou telemetria;
- transforma a conversa em `reuniao_final_agora_vai_7.xlsx`.

Em reuniões confidenciais, revise o código antes de usar. Confiança é boa; software aberto que você pode inspecionar é melhor.

## Desempenho

O runtime e os arquivos dos modelos somam aproximadamente 79 MB e são carregados localmente. A primeira utilização de cada direção pode ser mais lenta enquanto o modelo correspondente é carregado.

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
├── content.js                 Leitura do Meet, fila, overlay e histórico temporário
├── content.css                Aparência das legendas e do painel de histórico
├── background.js              Coordenação do documento offscreen
├── translator-host.html       Ambiente offscreen do tradutor
├── translator-host.js         Inicialização e uso do Bergamot
├── caption-settings.js        Validação das preferências visuais
├── translation-metrics.js     p50, p95, máximo e orçamento de latência
├── popup.html                 Painel de personalização com o Legê
├── popup-state.js             Estado temporário e mensagens do painel
├── models/bergamot/en-pt/     Modelo, vocabulário e lista lexical EN→PT
├── models/bergamot/pt-en/     Modelo, vocabulário e lista lexical PT→EN
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
- nomes, revisões e separação das falas no histórico temporário;
- posicionamento do overlay;
- validação das preferências;
- estado e texto do controle no menu do Meet.

Não existe uma etapa de build: JavaScript, CSS, HTML, WASM e os modelos são carregados diretamente pela extensão.

## Limites honestos

- Funciona somente em `meet.google.com`.
- Requer um navegador Chromium com suporte a extensões Manifest V3 e documentos offscreen.
- As legendas instantâneas precisam estar ativadas.
- Os modelos embarcados traduzem somente entre inglês e português.
- A detecção de idioma é heurística; frases curtas, misturadas ou ambíguas podem ser classificadas incorretamente.
- O histórico usa memória da aba enquanto estiver ligado; reuniões muito longas produzem listas maiores.
- O item de ativação reconhece atualmente os menus **Settings** e **Configurações**; outros idiomas de interface podem não exibi-lo.
- O Meet não oferece uma API pública estável para esse fluxo. Mudanças no DOM, nos seletores ou no comportamento offscreen podem exigir manutenção.
- A instalação é manual; o projeto não está publicado na Chrome Web Store.
- A tradução é local, mas a reunião do Google Meet obviamente ainda precisa de internet. O Legê é talentoso, não mágico.

## Licenças e componentes de terceiros

O código próprio está sob [MIT](LICENSE): gratuito para uso pessoal, acadêmico e comercial, com permissão para copiar, modificar e distribuir conforme os termos da licença.

O runtime Bergamot e os modelos EN→PT e PT→EN estão sob MPL-2.0. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e [THIRD_PARTY_LICENSES/MPL-2.0.txt](THIRD_PARTY_LICENSES/MPL-2.0.txt).

A arte do mascote foi fornecida para uso neste projeto, mas não está incluída na MIT do código sem confirmação separada dos direitos autorais.

## Contribuições

Correções, melhorias e ideias são bem-vindas. Se o Meet mudar o DOM novamente, não entre em pânico: abra uma issue, descreva o comportamento observado e inclua o diagnóstico já higienizado.

Este é um projeto independente e não oficial. Não é afiliado, patrocinado ou mantido pelo Google.

---

<p align="center">
  Feito para aproximar idiomas — não para criar mais uma assinatura mensal.
</p>
