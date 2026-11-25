# Cooperativas de Habitação

Inquérito em português sobre construção em propriedade coletiva e individual. O site usa HTML, CSS e JavaScript. Cloudflare Workers serve o site e a API no mesmo endereço, e Cloudflare D1 guarda as respostas. O código pode ficar num repositório privado no GitHub Free.

Cada envio conta uma vez em cada opção selecionada. A contagem corresponde aos envios registados. Uma cooperativa pode aparecer em ambas as barras e pode realizar mais do que um envio. Repetir o mesmo pedido após uma falha de rede não duplica a resposta.

## Experimentar localmente

É necessário Node.js 22 ou posterior. O comando abaixo cria uma base D1 de desenvolvimento, persistida em `.wrangler/` e partilhada entre os visitantes da mesma instância de preview. Pode ser usado sem conta Cloudflare. Para experimentar, utiliza um endereço fictício como `teste@example.com`.

```sh
npm ci
npm run db:local
npm run dev
```

Abre o endereço que o Wrangler mostrar no terminal.

## Configurar e publicar após aprovação

1. Entra numa conta [Cloudflare](https://dash.cloudflare.com/) com o plano Workers Free. Na secção **Workers & Pages**, ativa o subdomínio gratuito `workers.dev` se a conta ainda não o tiver.
2. No diretório do projeto, executa:

   ```sh
   npm ci
   npx wrangler login
   npx wrangler d1 create cooperativas-habitacao
   ```

3. Copia o `database_id` devolvido pelo comando para a entrada `DB` de `wrangler.jsonc`, em substituição do UUID de zeros. O ID identifica o recurso. A autenticação pertence à conta Cloudflare.
4. Cria a tabela na base partilhada e publica o Worker:

   ```sh
   npm run db:remote
   npm run deploy
   ```

5. Usa o endereço HTTPS `workers.dev` apresentado no terminal. A base de produção começa vazia e é independente da base de preview. O Workers Free e o D1 Free têm [limites de pedidos e armazenamento](https://developers.cloudflare.com/d1/platform/pricing/).

## Acesso aos dados

O Worker guarda o nome, o email e as opções na tabela D1. A API devolve exclusivamente três números: total de respostas, total com propriedade coletiva e total com propriedade individual. Os contactos podem ser consultados por pessoas com acesso à base na conta Cloudflare, em **Storage & databases → D1**. Mantém a base e as credenciais sob acesso restrito. O diretório público contém apenas o site e os seus recursos.
