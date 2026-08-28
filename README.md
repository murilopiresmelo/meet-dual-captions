<p align="center">
  <img src="assets/mascot.png" width="220" alt="Legê, mascote do Meet Dual Captions">
</p>

# Meet Dual Captions

> Duas legendas, uma reunião e bem menos cara de “aham, entendi”.

Extensão Manifest V3 para Chrome, Chromium e Microsoft Edge que coloca inglês e português juntos no Google Meet. Ela identifica o idioma da fala, preserva a legenda original e exibe a tradução logo abaixo — tudo na mesma aba.

O mascote é o **Legê**: poliglota, cafeinado e contratualmente proibido de dizer “você está no mudo”.

## O que ela faz

- mostra original e tradução em caixas independentes;
- traduz inglês → português localmente com Bergamot/WASM;
- permite ajustar alinhamento, cor e tamanho de cada idioma;
- não envia, grava nem armazena o texto das legendas;
- pode ser ligada ou desligada pelo menu de três pontos do Meet.

## Instalação local

1. Baixe este repositório (`Code` → `Download ZIP`) e descompacte-o.
2. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.
5. Recarregue as abas do Meet que já estavam abertas.

## Como usar

1. Entre em uma reunião e ligue as legendas do Meet.
2. No menu de três pontos, deixe **Legendas duplas — Ligadas**.
3. Clique no ícone do Legê para personalizar cores, tamanhos e alinhamento.
4. Fale normalmente. Fingir que entendeu continua opcional, mas agora ficou mais difícil.

O modelo local incluído cobre inglês → português.

## Privacidade

A tradução roda no navegador. O texto das legendas fica somente na memória da aba e não é enviado para API, servidor ou planilha misteriosa. O `chrome.storage` guarda apenas as preferências visuais; o estado ligado/desligado fica no armazenamento local da página.

## Desenvolvimento

Requer Node.js 18 ou mais recente.

```sh
npm install
npm test
npm run check
```

O projeto inclui o modelo Bergamot EN→PT e o runtime WASM necessários para funcionar offline. Os testes usam o test runner nativo do Node — sem uma catedral de dependências para testar um botão.

### Diagnóstico no Meet

Abra o console da página e execute:

```js
window.__meetDualCaptionsDebug
```

O objeto mostra a região de legendas detectada, o último par EN/PT e as métricas locais de tradução.

## Limites honestos

- O Meet não oferece uma API pública estável para duas faixas simultâneas; a extensão observa a região acessível de legendas. Mudanças no DOM do Meet podem exigir manutenção.
- O modelo local incluído traduz EN→PT. O caminho PT→EN depende da faixa traduzida oferecida pelo Meet.
- A extensão não publica nada na Chrome Web Store; a instalação atual é manual.

## Licença: pode pegar, é grátis mesmo

O código próprio deste projeto usa a [licença MIT](LICENSE): uso, cópia, alteração e distribuição são permitidos gratuitamente para todo mundo. Só não vale culpar o Legê se alguém entrar na reunião sem café.

O runtime Bergamot e o modelo de tradução são componentes de terceiros sob MPL-2.0; veja os [avisos e fontes](THIRD_PARTY_NOTICES.md). A arte do mascote foi fornecida para uso no projeto, mas não é incluída na MIT sem confirmação separada dos direitos autorais.

Feito para aproximar idiomas, não para criar mais uma assinatura mensal.
