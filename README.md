# PPX Log Explorer

Aplicação React + TypeScript + Vite para análise local de logs PPX. Inclui importação, pesquisa temporal, expansão e cópia de eventos, paginação e exportação `.log`, com tema escuro e layout responsivo. O parser da primeira etapa foi mantido.

## Abrir no navegador

Na pasta do projeto, execute:

```sh
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. Se as dependências já estiverem instaladas, basta `npm run dev`. Mantenha o terminal aberto; `Ctrl+C` termina o servidor. Se a porta 5173 estiver ocupada, termine o servidor anterior ou use `npm run dev -- --port 5174` e abra a porta indicada.

Para experimentar o build de produção:

```sh
npm run build
npm run preview
```

O preview usa **http://127.0.0.1:4173**. Não abra `index.html` diretamente: os módulos e o Web Worker precisam do servidor local.

## Publicar no GitHub Pages

O workflow do GitHub Actions publica automaticamente a aplicação em
**https://brunomoscoso.github.io/PPX-Log-Explore/** quando há alterações na branch `main`.
Para ativar a publicação, abra **Settings → Pages** no repositório e selecione
**GitHub Actions** como fonte de build e deploy. Também é possível iniciar uma
publicação manual pela aba **Actions**, usando o workflow **Deploy to GitHub Pages**.

A aplicação é estática e processa os logs localmente no navegador; os ficheiros
selecionados pelo utilizador não são enviados ao GitHub Pages. O código do
repositório e o site publicado podem ser públicos, por isso não inclua logs reais,
credenciais ou outros dados privados no repositório.

## Utilizar a aplicação

Escolha a aba **ComServer** ou **PollingV6** antes de importar. Cada aba mantém o seu ficheiro, filtros, resultados e página de forma independente durante a sessão.

Na aba **PollingV6**, mantenha o intervalo de datas/horas e combine os seis **Filtros rápidos**. Cada clique aplica a pesquisa imediatamente e permite ativar ou desativar um atalho. Requests e responses selecionados juntos mostram ambos. Os estados selecionados são combinados por OU e restringem os tipos escolhidos: requests + falhas mostra apenas pedidos com falha; falhas + comunicação mostra eventos de qualquer desses estados. Sem atalhos ativos, aparecem todos os eventos do intervalo. **Limpar filtros** desativa todos os atalhos e repõe o intervalo completo.

- **Somente requests**: pedidos `Starting ... with request`, frames `REQUEST IP:` e esperas `Starting listening for transaction`.
- **Somente responses**: respostas `Ended ... Response`, frames `RESPONSE IP:` e mensagens de resposta recebida (ACK/EOT/Last).
- **Operações com falha**: ERROR/FATAL, `Success: false`, `ResultType: FAILURE/ERROR`, abortos e falhas explícitas. Inclui o pedido Hub associado e eventos que identificam a mesma transação com falha.
- **Sem response identificada**: pedidos Hub sem resposta na mesma operação/componente/thread ou esperas de transação sem resposta para o mesmo ID/tipo. A associação considera o ficheiro inteiro, mesmo fora do intervalo. Casos ambíguos permanecem sem resposta identificada; frames sem ID de transação não são emparelhados por proximidade. A ausência de resposta no ficheiro não confirma uma falha.
- **Erros de comunicação**: timeouts, desconexões, falhas de ligação, NACK e frames inválidos.
- **Transações completas**: eventos com ID de uma transação que tem início e `was completed correctly`, sem aborto. ACK/EOT isolados e a mensagem genérica `completed` não bastam.

Os resultados de todos os atalhos respeitam o intervalo selecionado. A caixa **Buscar texto no log** filtra automaticamente ao escrever, procurando texto literal no evento completo, incluindo continuações, sem distinguir maiúsculas/minúsculas. A busca combina-se com os atalhos e horários e abrange todas as páginas. **Ctrl+F** (ou **Cmd+F**) foca a caixa quando a aba PollingV6 tem um ficheiro carregado e não há um modal aberto. **Limpar filtros** também limpa o texto. O parser preserva as quatro casas decimais dos timestamps e as continuações. Cópia e exportação mantêm o texto original. Cada aba conserva a sua pesquisa ao alternar.


Na aba **ComServer**:

A caixa **Buscar texto no log**, à esquerda de **Adicionar filtro**, pesquisa texto literal enquanto escreve, sem distinguir maiúsculas/minúsculas. **Ctrl+F** ou **Cmd+F** foca a caixa quando não há um modal aberto. A busca combina-se com os filtros e horários, mantendo os pedidos e respostas associados, e funciona também em Debug total e Apenas chamadas com erro. **Limpar filtros** limpa igualmente o texto.

Também estão disponíveis **Tipo da fatura** (`subType`), **MOP** (`clientTransactionsMops[].externalCode`) e **Número do ticket** (`ticketNumber`). O MOP não procura campos `externalCode` de outros objetos. Todos os campos têm um exemplo de preenchimento: escreva apenas o valor, sem aspas ou chave JSON. Para o tipo da fatura, use o texto completo, como `Fatura Simplificada`; para o ticket, mantenha todos os dígitos.

Use **Adicionar filtro** para selecionar número da transação, artigo, posição, família, litros, total, total com desconto, cartão Continente, telemóvel Continente, cupão ou fatura. Preencha os valores e clique em **Pesquisar**. Os filtros preenchidos são combinados (todos têm de corresponder), com correspondência exata; campos vazios não restringem a pesquisa. Litros e montantes aceitam ponto ou vírgula decimal e zeros finais (`10`, `10.00` e `10,00` são equivalentes). Identificadores preservam zeros iniciais e o artigo pode ter qualquer prefixo.

O número da transação pesquisa `TransactionExternalId`, `originTransactionId` e `nativeId`. A fatura pesquisa `invoiceNumber` e `referenceId`, incluindo o tipo. O cupão pesquisa especificamente `vouchers[].clientLoyalty.code`. As chaves JSON são reconhecidas sem distinguir maiúsculas/minúsculas, em objetos e listas de blocos JSON completos. Os campos podem estar na request ou na response da mesma chamada correlacionada; as duas mensagens continuam juntas. Os filtros também se aplicam a **Debug total** e **Apenas chamadas com erro**. Cópia, exportação e paginação usam a última pesquisa aplicada. **Limpar filtros** remove os filtros adicionados e repõe o intervalo completo.

1. Selecione ou arraste um ficheiro `.log` ou `.txt` codificado em UTF-8.
2. A aplicação preenche o intervalo mínimo/máximo do ficheiro e apresenta os eventos HTTP JSON em ordem cronológica. **Debug total** começa desmarcado; ative-o para pesquisar todos os eventos, como no modo anterior.
3. Ajuste as quatro datas/horas e clique em **Pesquisar**.
4. Clique num evento, ou use Enter/Espaço, para abrir um modal centrado com JSON automaticamente indentado e scroll próprio. Feche ao clicar fora, premir Escape ou usar o botão de fechar; o foco regressa à linha selecionada. **Ver original** permite consultar o texto exato. **Copiar evento** copia o evento completo com o JSON indentado; **Copiar resultados** e **Exportar .log** preservam o conteúdo original. JSON inválido ou incompleto mantém-se como está; a formatação visual não altera os dados, a ordem das propriedades ou a precisão dos números.
5. **Copiar resultados** e **Exportar .log** incluem todos os resultados da pesquisa aplicada, mesmo que existam várias páginas.
6. **Limpar filtros** repõe o intervalo completo e volta a pesquisar, mantendo o ficheiro carregado e o modo selecionado.

Não há upload para servidores, backend ou autenticação. Os dados ficam apenas na memória da sessão; recarregar ou fechar a página descarta os logs. A substituição de ficheiro liberta o worker anterior da aba correspondente.

## Modo HTTP JSON e Debug total

Com **Debug total** desmarcado, a aplicação reconhece os eventos `LoggingHandler - Request:` / `Response:` com cabeçalhos HTTP. Inclui requests cujo `Accept` aceita `application/json` e responses correlacionadas por `x-correlation-id`, mesmo que sejam erros ou tenham corpo incompleto. Como responses normalmente não repetem `Accept`, também inclui responses sem request correlacionada quando o corpo é um objeto ou lista JSON válido. A interface indica quantas respostas foram reconhecidas dessa forma; não inventa pares com base na proximidade das linhas.

O identificador de correlação pode ser reutilizado: para classificar uma response, considera-se a request anterior mais recente com esse ID. Uma response associada a uma request que não aceita JSON fica fora do modo padrão. Cabeçalhos aparentes dentro do body não contam. Pedidos internos `Request Header:` e os restantes logs continuam disponíveis em Debug total.

O conjunto HTTP e o índice de pares são preparados uma vez no worker durante a importação. Datas e horas identificam as mensagens correspondentes no modo escolhido; em seguida, cada request encontrada inclui a response correspondente por `x-correlation-id`, e vice-versa. A mensagem acrescentada não precisa de estar dentro do intervalo: a interface indica **Incluída por correlação**, a linha do par e **Fora do intervalo**, quando aplicável. As duas mensagens entram na cópia e exportação, sem duplicados, em ordem cronológica. O índice distingue chamadas sequenciais que reutilizam um ID e não associa chamadas ambíguas ou sem correlação segura.

Alternar Debug total executa a pesquisa com os valores atuais; se houver um filtro inválido, é apresentada a validação e os resultados anteriores mantêm-se até uma pesquisa válida. Paginação, cópia e exportação usam a última pesquisa aplicada.

Na lista, requests HTTP mostram método e URL, e responses mostram o estado. Ambas têm separadores **Header** e **Body** no modal, com pesquisa local ao bloco exibido.

### Apenas chamadas com erro

Ative **Apenas chamadas com erro** para consultar respostas HTTP **400–599**, incluindo estados por nome como `BadRequest`, `NotFound` e `InternalServerError`, sem indicar um código. Este modo pesquisa os erros HTTP de todo o ficheiro, independentemente de Accept ou do formato do body; Debug total fica temporariamente indisponível e a sua escolha anterior é recuperada ao desativar o modo de erros.

O intervalo é aplicado ao **horário da response**. Cada resultado representa uma chamada, com método, URL, estado e acesso a **Request / Response** no mesmo modal. A request pode estar fora do intervalo e aparece identificada como tal. Respostas sem associação segura mostram **Request não identificada**, sem serem descartadas. A associação consome as requests por `x-correlation-id` na ordem do ficheiro, incluindo respostas de sucesso; IDs reutilizados em sequência são suportados, mas várias requests pendentes com o mesmo ID tornam a associação ambígua e não são emparelhadas por suposição.

A paginação conta chamadas, não eventos individuais. **Copiar chamada** copia os dois eventos formatados; **Copiar evento** copia o separador Request/Response selecionado. **Copiar resultados** e **Exportar .log** incluem as duplas completas de todas as páginas, em ordem da response, com o texto original e incluindo requests fora do intervalo. Filtros inválidos mantêm a última pesquisa válida e a respetiva exportação.

## Pesquisa e detalhes

O seletor de filtros adicionais está vazio e desativado, preparado para uma futura reformulação. O catálogo e a lógica dos filtros anteriores foram removidos.

Cada bloco iniciado por `Request Header:` com um `Timestamp` válido é tratado como um evento próprio, identificado como **REQUEST** na coluna **Tipo**. O horário do cabeçalho da requisição é usado na pesquisa temporal; a coluna **Nível** continua reservada a `DEBUG`, `INFO`, `WARN` e outros níveis do log. No modal de um pedido, os botões **Header** e **Body** mostram cada secção separadamente; **Copiar evento** continua a copiar o bloco completo.

A barra **Pesquisar neste bloco** procura texto apenas no conteúdo visível do modal, sem distinguir maiúsculas de minúsculas. As ocorrências ficam destacadas e podem ser percorridas pelas setas ou com **Enter** / **Shift + Enter**, com deslocamento automático até ao resultado. **Ctrl + F** (ou **Cmd + F**) dentro do modal foca esta pesquisa. Ao mudar de secção ou de vista, os resultados são recalculados.

## Estado da análise

Na análise local do `ComServer.log` fornecido para o modo HTTP, o parser reconheceu **5.353 eventos**, sem timestamps inválidos. O modo padrão selecionou **140 eventos: 70 requests com Accept JSON e 70 responses**. Nenhuma response tinha `Accept` ou `Content-Type: application/json`; 64 foram reconhecidas pela correlação e 6 pelo corpo JSON. Há identificadores de correlação reutilizados, pelo que não se deve agrupar todo o ficheiro apenas pelo ID. A validação usou apenas estatísticas; o ficheiro real não foi adicionado ao projeto.

O parser inicial foi desenvolvido com exemplos sintéticos. Foi posteriormente analisado localmente o excerto real fornecido para os filtros de transação: foram reconhecidos 241 eventos e os dez campos pedidos. Os blocos iniciais de Request têm timestamp próprio no cabeçalho e podem ser pesquisados como eventos. Os dados reais não foram copiados para o projeto ou para fixtures; os testes automatizados continuam a usar exclusivamente dados inventados.

Aspetos identificados nos exemplos e tratados nesta etapa:

- As linhas de JSON pertencem ao evento anterior; não são eventos independentes.
- Existem campos vazios entre pipes. O parser não depende de uma quantidade fixa de identificadores.
- Os horários têm milissegundos e não indicam fuso horário.
- Mensagens podem conter pipes, quebras de linha e o separador ` - `.
- Datas impossíveis e cabeçalhos incompletos precisam de tratamento tolerante, sem perda de texto.

## Executar as verificações

Requer Node.js `^22.12.0`, `^24.0.0` ou `>=26.0.0` e npm. As versões das dependências ficam fixadas em `package-lock.json`.

```sh
npm ci
npm run check
```

Comandos individuais:

```sh
npm run typecheck
npm test
npm run test:watch
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run check` executa TypeScript e Vitest. `npm run test:e2e` compila a aplicação e inicia/termina automaticamente o preview na porta 4173 para os testes Chromium. Essa porta deve estar livre. `npm run test:e2e:ui` abre a interface de testes Playwright. A instalação inicial das dependências e do navegador de testes necessita de rede; a análise dos logs não usa rede.

## Estrutura atual

```text
src/
  App.tsx                    Estado da sessão e integração dos componentes
  main.tsx                   Entrada React
  styles.css                 Tema, controlos e responsividade
  styles/logs.css            Lista de eventos, expansão e paginação
  components/                Header, FileUpload, DateTimeFilter, LogViewer,
                             LogEventItem e ícones SVG locais
  types/log.types.ts          Contratos dos eventos, resultados e avisos
  types/worker.types.ts       Protocolo de mensagens e páginas
  services/logTimestamp.ts    Validação e conversão numérica do calendário
  services/logParser.ts       Extração de eventos e metadados
  services/logFilter.ts       Intervalos inclusivos e ordenação estável
  services/logExporter.ts     Serialização, cópia e download
  services/logWorkerClient.ts Comunicação assíncrona com o worker
  workers/log.worker.ts       Leitura, parsing, pesquisa e preparação da exportação
tests/
  fixtures/                  Exemplos inventados, sem dados internos
  unit/                      Testes do parser, timestamps, filtro e exportação
  e2e/explorer.spec.ts        Fluxos completos no Chromium
index.html
vite.config.ts
vitest.config.ts
playwright.config.ts
tsconfig.json
```

## Contrato do parser

```ts
import { parseLog } from './src/services/logParser';

const result = parseLog(text);
// result.events: eventos na ordem original do ficheiro
// result.preamble: texto anterior ao primeiro evento válido
// result.issues: avisos com número da linha, sem reproduzir dados do log
```

`parseLog` recebe o texto já descodificado. É uma função pura: não lê ficheiros, não acede à rede, não escreve no console e não guarda dados. O worker lê os bytes com `File.arrayBuffer()` e descodifica UTF-8 estritamente, preservando o BOM. Codificações incompatíveis geram um erro integrado na interface, em vez de substituir caracteres silenciosamente.

### Início e continuação de eventos

Um evento começa com `YYYY/MM/DD HH:mm:ss.SSS` válido na primeira posição da linha, seguido de `|` ou do fim da linha. Um BOM inicial é aceite e preservado. Não se removem espaços para reconhecer cabeçalhos: uma linha indentada é uma continuação.

Qualquer outra linha pertence ao evento anterior. Se não houver evento anterior, fica em `preamble`. Linhas que parecem começar com timestamp, mas têm formato ou data inválidos, geram um aviso `invalid-timestamp` e permanecem no texto. Um ficheiro sem eventos devolve `events: []` e todo o seu conteúdo em `preamble`.

Um timestamp válido pode iniciar um evento mesmo que os restantes campos estejam incompletos. Não existe filtro de níveis, componentes ou mensagens. Se uma mensagem incluir uma linha que imite exatamente um novo cabeçalho válido, o formato não permite distingui-la de um evento; é interpretada como novo evento.

### Preservação do original

`raw` é um segmento exato da string de entrada, incluindo CRLF, LF ou CR, linhas vazias, espaços e o terminador final, quando existe. O parser não utiliza `trim()` nem normaliza JSONs. A seguinte identidade verifica-se mesmo para entradas malformadas:

```ts
result.preamble + result.events.map(event => event.raw).join('') === text
```

`lineNumber` começa em 1. `startOffset` e `endOffset` são posições UTF-16 na string, com fim exclusivo; não são offsets de bytes no ficheiro. `id` deriva da linha inicial e é único dentro do ficheiro. A interface substitui o conjunto de eventos ao carregar outro ficheiro.

O parser mantém a ordem original, incluindo timestamps repetidos ou fora de ordem. O serviço de filtragem ordena cronologicamente com desempate pela posição original, sem alterar os eventos de origem.

### Metadados

O nível é o campo após o timestamp. A thread é reconhecida quando tem o formato `[valor]`. O componente é o campo delimitado por pipes imediatamente anterior ao primeiro separador ` - `; os identificadores anteriores são preservados em `raw`. A mensagem inclui tudo depois desse separador e todas as continuações. Sem separador reconhecido, o restante cabeçalho fica em `message` e `component` fica ausente.

Esta extração de metadados é tolerante e baseada nos exemplos. Um campo de identificador que contenha ` - ` pode ser ambíguo; o ficheiro real permitirá confirmar se é necessário especializar a regra. O conteúdo original não depende da extração dos metadados.

### Calendário sem fuso horário

`parseLogTimestamp` devolve `number | null`. O número conta milissegundos numa escala de calendário construída com métodos UTC, que evitam aplicar o fuso ou as mudanças de hora da máquina. **Não atribui UTC ao horário do log nem representa um instante real com fuso conhecido.** A apresentação deve utilizar `timestampText`.

São rejeitadas datas impossíveis, horas fora dos limites e precisões diferentes de três casas decimais. Os anos aceites vão de 0001 a 9999. São validados anos bissextos; segundos intercalares não são aceites.

O filtro converte os quatro campos usando a mesma escala. O limite inicial usa `.000`; o limite final usa `.999`, ambos inclusivos. Assim, uma pesquisa até `14:35:00` inclui `14:35:00.999`, mas exclui `14:35:01.000`. Não se comparam strings formatadas nem se usa parsing local de datas.

## Componentes e serviços implementados

| Ficheiro | Responsabilidade |
| --- | --- |
| `App.tsx` | Estado do ficheiro, eventos e pesquisa aplicada; em memória |
| `components/Header.tsx` | Identidade da aplicação e nome do ficheiro |
| `components/FileUpload.tsx` | Seleção, drag-and-drop, substituição e erros de leitura |
| `components/DateTimeFilter.tsx` | Quatro campos temporais, Pesquisar e Limpar filtros |
| `components/LogViewer.tsx` | Resultados cronológicos e paginação de 100 eventos |
| `components/LogEventItem.tsx` | Metadados, expansão do texto original e cópia individual |
| `services/logFilter.ts` | Validação do intervalo, limites inclusivos e ordenação estável |
| `services/logExporter.ts` | Composição do texto e nome de exportação, sem metadados artificiais |
| `workers/log.worker.ts` | Leitura, parsing, ordenação, pesquisa e serialização fora da thread da interface |
| `services/logWorkerClient.ts` | Pedidos assíncronos e gestão do ciclo de vida do worker |
| `tests/e2e/` | Fluxo de upload, pesquisa, expansão e exportação com Playwright |

React, Vite, CSS responsivo e Playwright integram esta entrega. A pesquisa utiliza o intervalo temporal; não há dashboards, gráficos ou filtros por nível. A lógica de parsing, pesquisa e composição da exportação permanece independente do React. Não há bibliotecas de componentes ou fontes remotas.

Na exportação, cada segmento `raw` e os seus terminadores são preservados. **Único caso de separação adicional:** se o antigo último evento não tiver terminador e a ordenação o colocar antes de outro, insere-se uma quebra de linha entre ambos para não colar os cabeçalhos. Usa-se o primeiro estilo de quebra encontrado nesse evento ou LF se não existir nenhum. Não são acrescentados cabeçalhos, comentários ou metadados ao ficheiro exportado.

O preâmbulo sem timestamp fica fora dos resultados e da exportação; a interface informa quando existe. O download preserva CRLF/LF/CR. A cópia de evento envia a versão indentada para a API Clipboard; copiar resultados envia o conteúdo original. O sistema operativo pode normalizar finais de linha na área de transferência. A cópia requer permissão do navegador e contexto seguro (localhost/127.0.0.1 ou HTTPS); em caso de falha, a interface sugere usar a exportação.

## Validação e limites

Os testes cobrem timestamps, datas inválidas, milissegundos, mudança de dia, independência das mudanças de hora, metadados, níveis, multiline, JSON, caracteres Unicode, BOM, posições originais, ordem e timestamps iguais, entradas vazias e malformadas, reconstrução exata do texto e 10 mil eventos sintéticos.

Os testes de filtro e exportação verificam limites inclusivos, ordenação estável, pesquisa entre dias, datas inválidas, preservação de texto e nomes de ficheiro. Os testes E2E verificam o fluxo real com Web Worker, upload e drag-and-drop, pesquisa, expansão por rato/teclado, clipboard, downloads, substituição, paginação, erros, texto HTML inerte e layout móvel. Todas as fixtures são sintéticas. A validação no navegador está limitada ao Chromium; outros motores não foram testados nesta entrega.

O parser percorre o texto sequencialmente. Leitura, parsing, ordenação, filtragem e serialização são executados num Web Worker; a interface recebe apenas a página atual e só renderiza detalhes expandidos. A paginação não limita os resultados pesquisados ou exportados. O ficheiro completo permanece em memória: ainda não há leitura em blocos, pelo que ficheiros muito grandes estão sujeitos à memória disponível. O teste de 10 mil eventos não constitui uma garantia de desempenho para ficheiros de qualquer tamanho.

Os logs são renderizados como texto React, sem `dangerouslySetInnerHTML`. Não há analytics nem armazenamento persistente de logs. O ficheiro é passado a um worker local, sem pedidos a APIs externas. Ficheiros `.log` reais estão ignorados pelo Git; as fixtures contêm exclusivamente dados inventados.

## Ficheiros desta entrega

Foram criados `index.html`, `vite.config.ts`, `playwright.config.ts`, `src/App.tsx`, `src/main.tsx`, os componentes e estilos, os serviços de filtragem/exportação/comunicação, o worker e respetivos tipos, os testes unitários de filtro/exportação, a fixture `browserLogs.ts` e a suite E2E. Foram atualizados `package.json`, `package-lock.json`, `tsconfig.json` e este README. `logParser.ts`, `logTimestamp.ts`, `log.types.ts` e os 52 testes originais mantêm-se sem alterações.
