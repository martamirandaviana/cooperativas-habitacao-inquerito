# Cooperativas de Habitação

Inquérito em português sobre construção em propriedade coletiva e individual. O site usa HTML, CSS e JavaScript. Um Worker serve o site e a API no mesmo endereço, e D1 guarda as respostas. O código fica num repositório privado no GitHub Free.

Cada envio conta uma vez em cada opção selecionada. A contagem corresponde aos envios registados. Uma cooperativa pode aparecer em ambas as barras e pode realizar mais do que um envio. Repetir o mesmo pedido após uma falha de rede não duplica a resposta.

## Experimentar localmente

É necessário Node.js 22 ou posterior. O comando abaixo cria uma base D1 de desenvolvimento, persistida em `.wrangler/` e partilhada entre os visitantes da mesma instância de preview. Pode ser usado sem conta Cloudflare. Para experimentar, utiliza um endereço fictício como `teste@example.com`.

```sh
npm ci
npm run db:local
npm run dev
```

Abre o endereço que o Wrangler mostrar no terminal.

## Publicação gerida pelo Codex Sites

O comando `npm run build:sites` empacota o mesmo formulário e a mesma API num Worker. O manifesto `.openai/hosting.json` associa a publicação ao projeto Sites e à base de produção `DB`. As migrações da base estão no diretório `drizzle/`. O Codex Sites gere a base de dados e o alojamento do site.

## Publicação alternativa numa conta Cloudflare

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

O Worker guarda o nome, o email e as opções na tabela D1. A API devolve exclusivamente três números: total de respostas, total com propriedade coletiva e total com propriedade individual. A consulta de contactos requer acesso de gestão à base de dados. O diretório público contém apenas o site e os seus recursos.
