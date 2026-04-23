# Guia Completo de Provedores de Transcricao

Este guia explica, de forma operacional, como usar transcricao na plataforma com selecao de provedor/modelo, quais cadastros sao necessarios, como obter API keys, custos, limites e como habilitar cada opcao sem erro.

## 1. O que ja existe hoje na plataforma

A plataforma ja suporta 3 provedores de transcricao, com selecao direta no settings:

- Groq (cloud) - modelos Whisper v3
- OpenAI (cloud) - modelo Whisper-1
- Local faster-whisper (open source, self-host)

Onde selecionar:

- Web: Configuracoes -> Agentes -> Provedor de Transcricao
- Mobile: Configuracoes -> Transcricao (agente)

## 2. Sobre "transcricao sem erros"

Nao existe, em 2026, modelo com acuracia de 100% em todos os cenarios reais (ruido, sobreposicao de vozes, sotaques fortes, microfone ruim, audio muito comprimido).

O que existe e combinacao de:

- Modelo adequado para o caso
- Boa captacao de audio
- Escolha correta de idioma
- Revisao humana quando o conteudo e critico (juridico, medico, compliance)

## 3. Matriz pratica de comparacao

| Provedor | Tipo | Registro | API key | Cobranca | Custo de referencia* | Limites* |
|---|---|---|---|---|---|---|
| Groq | Cloud | Sim, conta Groq | Sim | Direto no Groq | ~US$0.04 a ~US$0.111 por hora (modelo dependente) | Pode existir free tier com limite de req/min |
| OpenAI | Cloud | Sim, conta OpenAI | Sim | Direto na OpenAI | ~US$0.006 por minuto (~US$0.36/hora) | Sem free tier robusto para audio; depende de billing habilitado |
| Local faster-whisper | Open source self-host | Nao | Nao | Sem token; infra propria | Sem custo por minuto/token | Limitado pelo seu hardware (CPU/GPU/RAM) |

* Valores e limites mudam ao longo do tempo. Sempre confirme no painel oficial do provedor antes de calcular custo de producao.

## 4. Como habilitar no Gravador sem erro

1. Abra Configuracoes -> Provedores de IA.
2. Selecione o provedor cloud (OpenAI ou Groq) e salve a API key BYOK.
3. Abra Configuracoes -> Agentes -> Provedor de Transcricao.
4. Escolha o provedor de transcricao e o modelo.
5. Salve e execute reprocessamento para aplicacao em gravacoes antigas.

Observacao:

- Para modo local, nao ha API key externa, mas o endpoint LOCAL_WHISPER_URL precisa estar ativo.

## 5. Cadastro e API key por provedor

## 5.1 Groq (cloud)

Passos:

1. Criar conta: https://console.groq.com/
2. Gerar API key: https://console.groq.com/keys
3. (Se necessario) ativar billing no painel da conta.
4. Colar chave no Gravador em Configuracoes -> Provedores de IA -> Groq.
5. Em Agentes, selecionar Groq como provedor de transcricao.

Modelos comuns:

- whisper-large-v3
- whisper-large-v3-turbo

## 5.2 OpenAI (cloud)

Passos:

1. Criar conta: https://platform.openai.com/
2. Gerar API key: https://platform.openai.com/api-keys
3. Configurar billing: https://platform.openai.com/settings/organization/billing/overview
4. Colar chave no Gravador em Configuracoes -> Provedores de IA -> OpenAI.
5. Em Agentes, selecionar OpenAI como provedor de transcricao.

Modelo suportado no fluxo atual:

- whisper-1

## 5.3 Local faster-whisper (open source)

Sem cadastro e sem API key externa.

Passos (self-host recomendado):

1. Subir stack local com Docker Compose (ver docs/self-host.pt.md).
2. Garantir servico de transcricao ativo no endpoint configurado em LOCAL_WHISPER_URL (padrao: http://localhost:9000).
3. Em Agentes, selecionar Local (faster-whisper) e o modelo.

Modelos locais comuns:

- faster-whisper-large-v3
- faster-whisper-medium
- faster-whisper-small

## 6. Como funciona a cobranca

Para provedores cloud (Groq/OpenAI):

- O Gravador usa BYOK (Bring Your Own Key).
- A cobranca nao e feita pelo Gravador.
- O pagamento ocorre diretamente na conta do provedor associado a sua API key.

Para local:

- Sem custo por token/minuto.
- Custo operacional da sua infraestrutura (servidor, GPU, energia, observabilidade, etc.).

## 7. Recomendacao de uso por perfil

- Quer menor latencia com bom custo: Groq
- Quer baseline consolidada de qualidade: OpenAI Whisper-1
- Quer privacidade total e controle de dados: Local faster-whisper

## 8. Limites e boas praticas de producao

- Monitore taxa de erros por provedor e mantenha fallback operacional.
- Em audio longo, valide throughput real por hora para evitar backlog.
- Padronize idioma quando souber a lingua principal do audio.
- Sempre registre custo medio por hora de audio para previsibilidade financeira.

## 9. Troubleshooting rapido

- Erro Missing GROQ_API_KEY: chave Groq nao configurada no workspace/runtime.
- Erro Missing OPENAI_API_KEY: chave OpenAI nao configurada no workspace/runtime.
- Erro Local whisper failed: LOCAL_WHISPER_URL indisponivel ou servico local offline.
- Baixa acuracia: testar modelo maior, melhorar captacao, reduzir ruido, revisar idioma.

---

Atualizado em 2026-04-23.
