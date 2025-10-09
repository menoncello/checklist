# Mutation Testing com Stryker e Turbo

Este documento descreve como usar o sistema de mutation testing configurado com Stryker e Turbo.

## Overview

O projeto está configurado com mutation testing automatizado usando StrykerJS em conjunto com o Turbo para cache e execução paralela dos testes.

## Scripts Disponíveis

### Scripts Root (executam em todos os pacotes)

- `bun run test:mutation` - Executa mutation testing incremental em todos os pacotes
- `bun run test:mutation:all` - Executa em todos os pacotes (exceto shared)
- `bun run test:mutation:core` - Executa apenas no pacote core
- `bun run test:mutation:tui` - Executa apenas no pacote TUI
- `bun run test:mutation:cli` - Executa apenas no app CLI
- `bun run test:mutation:ci` - Executa para CI/CD com relatórios HTML e JSON
- `bun run test:mutation:report` - Executa com relatórios detalhados
- `bun run test:mutation:full` - Executa mutation testing completo (sem cache)
- `bun run test:mutation:clean` - Limpa e executa mutation testing

### Scripts por Pacote

Cada pacote tem seus próprios scripts:
- `test:mutation` - Execução incremental padrão
- `test:mutation:ci` - Configuração para CI/CD
- `test:mutation:report` - Gera relatórios HTML, JSON e texto
- `test:mutation:full` - Execução completa sem incremental
- `test:mutation:clean` - Limpa caches e executa

## Cache do Turbo

O Turbo mantém cache inteligente baseado em:
- Arquivos de origem (`src/**/*.ts`)
- Arquivos de teste (`test/**/*.ts`)
- Configurações (`stryker.conf.json`, `package.json`, `tsconfig.json`)
- Saídas geradas (`reports/mutation/**`, `.stryker-tmp/**`)

## Exemplos de Uso

### Executar mutation testing em um pacote específico
```bash
# Testar apenas o core package
bun run test:mutation:core

# Testar apenas o TUI package
bun run test:mutation:tui

# Testar usando filtro do Turbo
bun run test:mutation --filter=@checklist/core
```

### Executar em paralelo com cache
```bash
# Executar em todos os pacotes (exceto shared)
bun run test:mutation:all

# Executar com filtros Turbo
bun run test:mutation --filter=!@checklist/shared
```

### Gerar relatórios detalhados
```bash
# Para CI/CD
bun run test:mutation:ci

# Relatórios completos
bun run test:mutation:report
```

## Estrutura de Saída

Os relatórios são gerados em:
```
reports/mutation/
├── core/
│   ├── index.html         # Relatório HTML
│   ├── mutation-report.json # Dados JSON
│   └── ...               # Outros arquivos do Stryker
├── tui/
├── cli/
└── shared/
```

## Cache Strategy

O Turbo usa uma estratégia de cache eficiente:

1. **Dependências**: Cada pacote depende primeiro do `build`
2. **Inputs**: Cache baseado em mudanças nos arquivos de origem e teste
3. **Outputs**: Cache dos resultados e arquivos temporários
4. **Paralelização**: Executa múltiplos pacotes em paralelo quando possível

## Integração com CI/CD

Para CI/CD, use:
```bash
bun run test:mutation:ci
```

Este comando:
- Executa mutation testing incremental
- Gera relatórios HTML e JSON
- Salva em `reports/mutation/` para análise posterior
- Mantém cache para execuções futuras

## Boas Práticas

1. **Use incremental**: Prefira `test:mutation` sobre `test:mutation:full`
2. **Execute específico**: Use `test:mutation:core` para testar apenas o que mudou
3. **Limpe quando necessário**: Use `test:mutation:clean` se suspeitar de problemas de cache
4. **Analise relatórios**: Use `test:mutation:report` para insights detalhados

## Troubleshooting

### Cache não funcionando
```bash
# Limpe o cache do Turbo
rm -rf .turbo

# Limpe arquivos do Stryker
bun run test:mutation:clean
```

### Problemas de dependência
```bash
# Verifique se os pacotes estão construídos
bun run build

# Execute sem cache para depuração
bun run test:mutation:full
```