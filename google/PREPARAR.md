# Migração do inquérito para GitHub Pages e Google Sheets

## Criar a folha privada

1. Abre [uma folha nova no Google Sheets](https://sheets.new) na conta Google que vai guardar as respostas. Podes chamar-lhe **Inquérito Cooperativas de Habitação**.
2. Em **Partilhar**, mantém o acesso geral **Restrito**.
3. Na folha, abre **Extensões → Apps Script**. Substitui o código de exemplo pelo conteúdo de [Code.gs](Code.gs) e guarda.
4. No seletor acima do código, escolhe **configurarInquerito** e carrega em **Executar**. Autoriza o acesso à folha com a mesma conta. Quando voltares à folha, verifica que apareceu o separador **Respostas**.
5. No editor Apps Script, escolhe **Implementar → Nova implementação → Aplicação Web**. Em **Executar como**, escolhe a tua conta. Em **Quem tem acesso**, escolhe **Qualquer pessoa**. Esta definição permite submeter e obter os totais pelo site. A folha de cálculo mantém o acesso **Restrito**.
6. Carrega em **Implementar** e copia o **URL da aplicação Web**, que começa por `https://script.google.com/macros/s/` e termina em `/exec`. Esse é o endereço a colocar em `docs/survey-config.js`.

## Verificar antes de mudar o domínio

- A aplicação Web deve mostrar os três totais ao abrir o URL `/exec` numa janela privada.
- No repositório `cooperativas-habitacao-inquerito`, o GitHub Pages gratuito requer visibilidade pública. Com a aplicação Web configurada e testada, em **Settings → Pages**, escolhe **Deploy from a branch** e seleciona **main** e **/docs**.
- Depois de testar no endereço `github.io`, confirma que uma resposta de teste aparece na folha e que o gráfico conta nas duas barras quando se escolhe a opção combinada. Apaga a linha de teste da folha e verifica que os totais regressam ao valor anterior.
- Antes da transferência do domínio, confirma de novo os totais do site antigo. Se houver respostas entretanto, guarda e importa essas respostas antes de redirecionar os visitantes.
- Mantém os registos de DNS existentes até estares pronta para mudar. Depois segue a [configuração de um subdomínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) para apontar apenas `inquerito.mrt-arch.com` para o GitHub Pages.
