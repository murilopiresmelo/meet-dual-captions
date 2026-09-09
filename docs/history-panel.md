# Histórico flutuante e lateral

Arrastar pelo cabeçalho move o histórico dentro da janela. Soltar a até 32px de uma lateral encaixa o painel nesse lado; arrastar novamente o solta. Escape cancela um arraste. O painel permanece acessível ao redimensionar a janela.

Encaixado, reserva até 352px (no máximo 45% da janela) e reduz a área do Meet, incluindo descendentes posicionados de forma fixa. Ocultar o histórico ou desativar a extensão restaura o espaço. Posição e falas permanecem somente nesta aba.

Implementação: controlar posição e eventos no content.js; estilos de encaixe no content.css; verificar arraste, encaixe, cancelamento, redimensionamento e restauração em navegador, além da suíte existente. Validar também em reunião real: o DOM e os cálculos internos do Meet podem mudar.
